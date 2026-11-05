import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({error:"Authentication required"},{status:401});
    const [contacts,confirmed,products,campaigns,recipients,events,campaignRows] = await Promise.all([
      supabase.from("contacts").select("id",{count:"exact",head:true}).eq("user_id",user.id),
      supabase.from("contacts").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("status","subscribed").eq("consent_status","confirmed"),
      supabase.from("products").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("is_active",true),
      supabase.from("campaigns").select("id",{count:"exact",head:true}).eq("user_id",user.id),
      supabase.from("campaign_recipients").select("id",{count:"exact",head:true}).eq("status","sent"),
      supabase.from("email_events").select("event_type").eq("user_id",user.id).limit(10000),
      supabase.from("campaigns").select("status").eq("user_id",user.id).limit(1000)
    ]);
    for (const result of [contacts,confirmed,products,campaigns,recipients,events,campaignRows]) {
      if (result.error) return NextResponse.json({error:result.error.message},{status:400});
    }
    const eventCounts:Record<string,number> = {};
    for (const row of events.data || []) eventCounts[row.event_type]=(eventCounts[row.event_type]||0)+1;
    const campaignStatus:Record<string,number> = {};
    for (const row of campaignRows.data || []) campaignStatus[row.status]=(campaignStatus[row.status]||0)+1;
    return NextResponse.json({
      totals:{
        contacts:contacts.count||0,
        confirmedSubscribers:confirmed.count||0,
        activeProducts:products.count||0,
        campaigns:campaigns.count||0,
        emailsSent:recipients.count||0
      },
      campaignStatus,
      events:eventCounts,
      note:"Metrics reflect recorded Sendvoria and provider events. Opens and clicks require provider webhooks and may be affected by email privacy protections."
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Analytics unavailable"},{status:503});
  }
}
