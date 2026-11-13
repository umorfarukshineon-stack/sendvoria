import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await supabase.from("contacts")
      .select("id,email,first_name,last_name,status,consent_status,consent_source,consent_at,consent_method,tags,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ contacts: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contacts service unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const rows: unknown[] = Array.isArray(body.contacts) ? body.contacts : [body];
    if (!rows.length || rows.length > 1000) {
      return NextResponse.json({ error: "Submit between 1 and 1,000 contacts per request." }, { status: 400 });
    }
    if (rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
      return NextResponse.json({ error: "Every contact must be an object." }, { status: 400 });
    }

    const now = new Date();
    const records = rows as Array<Record<string, unknown>>;
    const invalidConsentDate = records.some(row => {
      if (row.consent_status !== "confirmed" || !row.consent_at) return false;
      const parsed = new Date(String(row.consent_at));
      return Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime() + 5 * 60 * 1000;
    });
    if (invalidConsentDate) {
      return NextResponse.json({ error: "Consent timestamps must be valid dates and cannot be in the future." }, { status: 400 });
    }

    const normalized = records.map(row => {
      const confirmed = row.consent_status === "confirmed";
      const source = confirmed ? String(row.consent_source ?? "").trim().slice(0, 120) : "";
      return {
        user_id: user.id,
        email: String(row.email ?? "").trim().toLowerCase(),
        first_name: row.first_name ? String(row.first_name).trim().slice(0, 100) : null,
        last_name: row.last_name ? String(row.last_name).trim().slice(0, 100) : null,
        status: confirmed ? "subscribed" : "pending",
        consent_status: confirmed ? "confirmed" : "unknown",
        consent_source: source || null,
        consent_method: confirmed ? "owner_attestation" : null,
        consent_evidence_reference: confirmed && row.consent_evidence_reference
          ? String(row.consent_evidence_reference).trim().slice(0, 500)
          : null,
        // If the CSV omits the original opt-in timestamp, this records when
        // the owner attested during import, not an independently verified opt-in time.
        consent_at: confirmed
          ? (row.consent_at ? new Date(String(row.consent_at)).toISOString() : now.toISOString())
          : null,
        status_source: confirmed ? "Authenticated owner CSV import" : "Authenticated CSV import",
        status_provider: "sendvoria",
        status_provider_event_id: null,
        tags: Array.isArray(row.tags) ? row.tags.map(String).map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 30) : []
      };
    });

    if (normalized.some(row => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))) {
      return NextResponse.json({ error: "One or more email addresses are invalid." }, { status: 400 });
    }
    if (normalized.some(row => row.consent_status === "confirmed" && !row.consent_source)) {
      return NextResponse.json({ error: "Provide the original opt-in source for every consent-confirmed import." }, { status: 400 });
    }

    const { data, error } = await supabase.from("contacts")
      .upsert(normalized, { onConflict: "user_id,email", ignoreDuplicates: true })
      .select("id,email,status,consent_status");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ imported: data?.length ?? 0, contacts: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contacts import failed" }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const id = String(body.id ?? "");
    const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 30) : null;
    if (!id || !tags) return NextResponse.json({ error: "Contact id and tags are required." }, { status: 400 });
    const { data, error } = await supabase.from("contacts")
      .update({ tags })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,email,tags")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ contact: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contact tag update failed" }, { status: 503 });
  }
}
