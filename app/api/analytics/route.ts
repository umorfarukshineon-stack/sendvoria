import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({error:"Authentication required"},{status:401});
    const { data: events, error } = await supabase.from("email_events")
      .select("event_type,campaign_id,occurred_at").eq("user_id",user.id).limit(10000);
    if (error) return NextResponse.json({error:error.message},{status:400});
    const counts = {sent:0,delivered:0,open:0,click:0,bounce:0,complaint:0,unsubscribe:0};
    for (const event of events || []) {
      if (event.event_type in counts) counts[event.event_type as keyof typeof counts] += 1;
    }
    const denominator = counts.delivered || counts.sent;
    return NextResponse.json({
      totals:counts,
      deliveryRate:counts.sent ? Math.round(counts.delivered/counts.sent*1000)/10 : 0,
      openRate:denominator ? Math.round(counts.open/denominator*1000)/10 : 0,
      clickRate:denominator ? Math.round(counts.click/denominator*1000)/10 : 0,
      note:"Metrics reflect recorded provider events. Opens may be affected by privacy protections and image proxying."
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Analytics unavailable"},{status:503});
  }
}
