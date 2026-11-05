import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const [contacts, subscribed, products, campaigns, events] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("status", "subscribed").eq("consent_status", "confirmed"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("campaigns").select("id,status", { count: "exact" }),
      supabase.from("email_events").select("event_type")
    ]);
    const errors = [contacts.error, subscribed.error, products.error, campaigns.error, events.error].filter(Boolean);
    if (errors.length) return NextResponse.json({ error: errors[0]?.message }, { status: 400 });
    const eventCounts = (events.data ?? []).reduce<Record<string, number>>((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({
      totals: {
        contacts: contacts.count ?? 0,
        confirmedSubscribers: subscribed.count ?? 0,
        activeProducts: products.count ?? 0,
        campaigns: campaigns.count ?? 0
      },
      events: eventCounts,
      note: "Metrics are based only on events received and stored by Sendvoria. Opens may be inflated or blocked by email-client privacy features; revenue needs an external-store integration."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics service unavailable" }, { status: 503 });
  }
}
