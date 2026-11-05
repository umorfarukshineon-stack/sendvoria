import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const [contacts, subscribed, products, campaigns, events, sent] = await Promise.all([
      supabase.from("contacts").select("id", {count:"exact",head:true}),
      supabase.from("contacts").select("id", {count:"exact",head:true}).eq("status","subscribed").eq("consent_status","confirmed"),
      supabase.from("products").select("id", {count:"exact",head:true}).eq("is_active",true),
      supabase.from("campaigns").select("id,status"),
      supabase.from("email_events").select("event_type,occurred_at").order("occurred_at",{ascending:false}).limit(5000),
      supabase.from("campaign_recipients").select("id",{count:"exact",head:true}).eq("status","sent")
    ]);
    const firstError = [contacts.error,subscribed.error,products.error,campaigns.error,events.error,sent.error].find(Boolean);
    if(firstError) return NextResponse.json({error:firstError.message},{status:400});
    const counts:Record<string,number> = {};
    for(const e of events.data ?? []) counts[e.event_type]=(counts[e.event_type]??0)+1;
    const campaignStatus:Record<string,number> = {};
    for(const c of campaigns.data ?? []) campaignStatus[c.status]=(campaignStatus[c.status]??0)+1;
    return NextResponse.json({
      totals:{contacts:contacts.count??0,confirmedSubscribers:subscribed.count??0,activeProducts:products.count??0,campaigns:campaigns.data?.length??0,emailsSent:sent.count??0},
      events:counts,campaignStatus,
      note:"Open and click metrics appear only after provider webhooks are configured. Revenue requires an external store integration."
    });
  } catch {
    return NextResponse.json({error:"Analytics service unavailable."},{status:503});
  }
}
