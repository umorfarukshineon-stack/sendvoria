import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await supabase.from("contacts").select("id,email,first_name,last_name,status,consent_status,tags,created_at").order("created_at", { ascending: false }).limit(500);
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
    const rows = Array.isArray(body.contacts) ? body.contacts : [body];
    if (!rows.length || rows.length > 1000) return NextResponse.json({ error: "Submit between 1 and 1,000 contacts per request." }, { status: 400 });
    const normalized = rows.map((row: Record<string, unknown>) => ({
      user_id: user.id,
      email: String(row.email ?? "").trim().toLowerCase(),
      first_name: row.first_name ? String(row.first_name).trim() : null,
      last_name: row.last_name ? String(row.last_name).trim() : null,
      status: row.consent_status === "confirmed" ? "subscribed" : "pending",
      consent_status: row.consent_status === "confirmed" ? "confirmed" : "unknown",
      consent_source: row.consent_source ? String(row.consent_source).slice(0, 120) : null,
      consent_at: row.consent_status === "confirmed" ? new Date().toISOString() : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 30) : []
    }));
    if (normalized.some(row => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))) {
      return NextResponse.json({ error: "One or more email addresses are invalid." }, { status: 400 });
    }
    const { data, error } = await supabase.from("contacts").upsert(normalized, { onConflict: "user_id,email", ignoreDuplicates: true }).select("id,email,status,consent_status");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ imported: data?.length ?? 0, contacts: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contacts import failed" }, { status: 503 });
  }
}
