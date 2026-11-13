import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (contactError) {
      return NextResponse.json({ error: "Could not verify contact ownership" }, { status: 503 });
    }
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("contact_consent_events")
      .select("id,event_type,source,method,evidence_reference,provider,provider_event_id,actor_user_id,occurred_at,recorded_at,previous_status,new_status,previous_consent_status,new_consent_status")
      .eq("user_id", user.id)
      .eq("contact_id", id)
      .order("recorded_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({
        error: "Consent history is unavailable. Apply the consent audit migration first."
      }, { status: 503 });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Consent history service unavailable" }, { status: 503 });
  }
}
