import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const configured = Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS && process.env.EMAIL_FROM_NAME);
  return NextResponse.json({
    provider: "Brevo",
    configured,
    sendingEnabled: false,
    dailyFreePlanLimit: 300,
    requirements: ["Brevo API key", "verified sender identity", "verified sending domain recommended", "documented marketing consent"]
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError("Authentication required", 401);

    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM_ADDRESS;
    const fromName = process.env.EMAIL_FROM_NAME || "Sendvoria";
    if (!apiKey || !fromEmail) return jsonError("Email provider is not configured. Add BREVO_API_KEY and EMAIL_FROM_ADDRESS in Render environment variables.", 503);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) return jsonError("EMAIL_FROM_ADDRESS is invalid.", 503);

    const { id } = await params;
    const { data: campaign, error: campaignError } = await supabase.from("campaigns")
      .select("id,user_id,name,subject,preview_text,html_content,text_content,status")
      .eq("id", id).eq("user_id", user.id).single();
    if (campaignError || !campaign) return jsonError("Campaign not found.", 404);
    if (campaign.status === "sent" || campaign.status === "sending") return jsonError("This campaign has already been sent or is currently sending.", 409);
    if (!campaign.html_content && !campaign.text_content) return jsonError("Add email content before sending.", 400);

    const { count: sentToday, error: countError } = await supabase.from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
    if (countError) return jsonError("Could not verify sending quota.", 503);
    const dailyLimit = Math.min(Number(process.env.SENDVORIA_DAILY_EMAIL_LIMIT || 300), 300);
    const remaining = Math.max(0, dailyLimit - (sentToday || 0));
    if (!remaining) return jsonError("Daily free sending limit reached. Try again after the quota resets.", 429);

    const { data: contacts, error: contactsError } = await supabase.from("contacts")
      .select("id,email,first_name,last_name,unsubscribe_token")
      .eq("user_id", user.id).eq("status", "subscribed").eq("consent_status", "confirmed")
      .order("created_at", { ascending: true }).limit(Math.min(remaining, 300));
    if (contactsError) return jsonError("Could not load eligible subscribers.", 503);
    if (!contacts?.length) return jsonError("No confirmed, subscribed contacts are eligible for this campaign.", 400);

    const { data: suppressions, error: suppressionError } = await supabase.from("suppression_list")
      .select("email").eq("user_id", user.id);
    if (suppressionError) return jsonError("Could not verify the suppression list.", 503);
    const blocked = new Set((suppressions || []).map(x => String(x.email).toLowerCase()));
    const { data: previouslyAttempted, error: previousError } = await supabase.from("campaign_recipients")
      .select("contact_id").eq("campaign_id", campaign.id);
    if (previousError) return jsonError("Could not check previous campaign recipients.", 503);
    const attemptedIds = new Set((previouslyAttempted || []).map(x => x.contact_id).filter(Boolean));
    const eligible = contacts.filter(c => !blocked.has(c.email.toLowerCase()) && !attemptedIds.has(c.id));
    if (!eligible.length) return jsonError("All selected contacts are suppressed.", 400);

    const origin = request.nextUrl.origin;
    const rawHtml = String(campaign.html_content || campaign.text_content || "");
    const htmlBase = rawHtml.includes("<") ? rawHtml : `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${rawHtml.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>`;
    const results: Array<{ email: string; status: string }> = [];
    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign.id).eq("user_id", user.id);

    for (const contact of eligible) {
      const unsubscribeUrl = `${origin}/api/unsubscribe?token=${contact.unsubscribe_token}`;
      const htmlContent = htmlBase
        .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
        .replace(/\{\{first_name\}\}/g, contact.first_name || "there")
        .replace(/\{\{email\}\}/g, contact.email);
      const htmlWithFooter = htmlContent.includes(unsubscribeUrl) ? htmlContent :
        htmlContent + `<hr><p style="font-size:12px;color:#777">You are receiving this email because you opted in to marketing updates. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;
      const { data: recipient, error: insertError } = await supabase.from("campaign_recipients").insert({
        campaign_id: campaign.id, contact_id: contact.id, email: contact.email, status: "pending"
      }).select("id").single();
      if (insertError || !recipient) { results.push({email:contact.email,status:"skipped"}); continue; }

      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "accept":"application/json", "api-key":apiKey, "content-type":"application/json" },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: contact.email, name: [contact.first_name,contact.last_name].filter(Boolean).join(" ") || contact.email }],
            subject: campaign.subject,
            htmlContent: htmlWithFooter,
            textContent: campaign.text_content || undefined,
            headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          await supabase.from("campaign_recipients").update({ status:"failed" }).eq("id",recipient.id);
          results.push({email:contact.email,status:"failed"});
          continue;
        }
        await supabase.from("campaign_recipients").update({
          status:"sent", provider_message_id: payload.messageId || null, sent_at:new Date().toISOString()
        }).eq("id",recipient.id);
        await supabase.from("email_events").insert({
          user_id:user.id,campaign_id:campaign.id,contact_id:contact.id,event_type:"sent",
          provider_event_id:payload.messageId || null,metadata:{provider:"brevo"}
        });
        results.push({email:contact.email,status:"sent"});
      } catch {
        await supabase.from("campaign_recipients").update({status:"failed"}).eq("id",recipient.id);
        results.push({email:contact.email,status:"failed"});
      }
    }
    const sent = results.filter(x=>x.status==="sent").length;
    const { count: remainingEligible } = await supabase.from("contacts").select("id",{count:"exact",head:true})
      .eq("user_id",user.id).eq("status","subscribed").eq("consent_status","confirmed");
    const finalStatus = sent ? ((remainingEligible || 0) > eligible.length ? "queued" : "sent") : "failed";
    await supabase.from("campaigns").update({status:finalStatus,sent_at:sent?new Date().toISOString():null}).eq("id",campaign.id).eq("user_id",user.id);
    return NextResponse.json({
      campaignId:campaign.id, attempted:eligible.length, sent, failed:results.length-sent,
      dailyLimit, remainingToday:Math.max(0,remaining-sent),
      note:"Only confirmed subscribers not on the suppression list were considered. Provider delivery/open/click events require the Brevo webhook integration."
    });
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Campaign send failed."},{status:503});
  }
}
