import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-sendvoria-webhook-secret") || request.nextUrl.searchParams.get("key");
  if (!secret || !supplied || supplied !== secret) return NextResponse.json({error:"Unauthorized webhook"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey) return NextResponse.json({error:"Webhook storage is not configured"},{status:503});
  const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body=await request.json();
    const events=Array.isArray(body)?body:[body];
    let processed=0;
    for(const event of events.slice(0,500)){
      const email=String(event.email||event.recipient||"").trim().toLowerCase();
      const messageId=String(event.messageId||event['message-id']||"");
      const kind=String(event.event||event.type||"").toLowerCase();
      const mapping:Record<string,string>={delivered:"delivered",opened:"open",open:"open",click:"click",hardbounce:"bounce",softbounce:"bounce",bounce:"bounce",spam:"complaint",complaint:"complaint",blocked:"bounce",unsubscribed:"unsubscribe"};
      const eventType=mapping[kind];
      if(!eventType||!messageId) continue;
      const {data:recipient}=await supabase.from("campaign_recipients").select("id,campaign_id,contact_id,email").eq("provider_message_id",messageId).maybeSingle();
      if(!recipient) continue;
      const {data:campaign}=await supabase.from("campaigns").select("user_id").eq("id",recipient.campaign_id).single();
      if(!campaign) continue;
      await supabase.from("email_events").insert({user_id:campaign.user_id,campaign_id:recipient.campaign_id,contact_id:recipient.contact_id,event_type:eventType,url:event.url||null,provider_event_id:String(event.id||messageId),metadata:{provider:"brevo",event:kind}});
      if(["delivered","bounce","complaint"].includes(eventType)) await supabase.from("campaign_recipients").update({status:eventType==="bounce"?"bounced":eventType}).eq("id",recipient.id);
      if(eventType==="bounce"||eventType==="complaint"){
        const reason=eventType==="bounce"?"hard_bounce":"spam_complaint";
        await supabase.from("suppression_list").upsert({user_id:campaign.user_id,email:recipient.email,reason,source:"Brevo webhook"},{onConflict:"user_id,email"});
        if(recipient.contact_id) await supabase.from("contacts").update({status:eventType==="bounce"?"bounced":"complained",consent_status:"withdrawn"}).eq("id",recipient.contact_id);
      }
      processed++;
    }
    return NextResponse.json({received:events.length,processed});
  } catch {
    return NextResponse.json({error:"Invalid webhook payload"},{status:400});
  }
}
