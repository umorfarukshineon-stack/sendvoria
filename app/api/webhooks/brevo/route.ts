import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function secretsMatch(supplied: string, expected: string) {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-sendvoria-webhook-secret") ?? "";
  if (!secret || !supplied || !secretsMatch(supplied, secret)) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Webhook storage is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const events = Array.isArray(body) ? body : [body];
  if (events.length > 500) {
    return NextResponse.json({ error: "A webhook batch may contain at most 500 events." }, { status: 413 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const mapping: Record<string, string> = {
    delivered: "delivered",
    opened: "open",
    open: "open",
    click: "click",
    hardbounce: "bounce",
    softbounce: "bounce",
    bounce: "bounce",
    spam: "complaint",
    complaint: "complaint",
    blocked: "bounce",
    unsubscribed: "unsubscribe"
  };

  let processed = 0;
  try {
    for (const rawEvent of events) {
      if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) continue;
      const event = rawEvent as Record<string, unknown>;
      const messageId = String(event.messageId ?? event["message-id"] ?? "");
      const kind = String(event.event ?? event.type ?? "").toLowerCase();
      const eventType = mapping[kind];
      if (!eventType || !messageId) continue;

      const { data: recipient, error: recipientError } = await supabase
        .from("campaign_recipients")
        .select("id,campaign_id,contact_id,email")
        .eq("provider_message_id", messageId)
        .maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient) continue;

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("user_id")
        .eq("id", recipient.campaign_id)
        .single();
      if (campaignError || !campaign) throw campaignError ?? new Error("Campaign not found for webhook recipient.");

      // Brevo's event ID is stable across webhook retries. Do not use messageId
      // as a fallback: one message can legitimately produce several event types.
      const providerEventId = event.id === undefined || event.id === null || event.id === ""
        ? null
        : String(event.id);
      const providerEventFingerprint = providerEventId ? `brevo:${providerEventId}` : null;
      const { error: eventError } = await supabase.from("email_events").upsert({
        user_id: campaign.user_id,
        campaign_id: recipient.campaign_id,
        contact_id: recipient.contact_id,
        event_type: eventType,
        url: typeof event.url === "string" ? event.url : null,
        provider_event_id: providerEventId,
        provider_event_fingerprint: providerEventFingerprint,
        metadata: { provider: "brevo", event: kind }
      }, {
        onConflict: "user_id,provider_event_fingerprint",
        ignoreDuplicates: true
      });
      if (eventError) throw eventError;

      if (eventType === "delivered" || eventType === "bounce" || eventType === "complaint") {
        const recipientStatus = eventType === "delivered" ? "delivered" : eventType === "bounce" ? "bounced" : "complained";
        const { error } = await supabase.from("campaign_recipients")
          .update({ status: recipientStatus })
          .eq("id", recipient.id);
        if (error) throw error;
      }

      // Soft bounces are recorded but are not treated as permanent suppression.
      // Hard bounces, complaints and explicit unsubscribes are suppressed.
      const isHardBounce = eventType === "bounce" && kind !== "softbounce";
      const suppressionReason = eventType === "complaint"
        ? "spam_complaint"
        : eventType === "unsubscribe"
          ? "unsubscribe"
          : isHardBounce
            ? "hard_bounce"
            : null;

      if (suppressionReason) {
        const { error: suppressionError } = await supabase.from("suppression_list").upsert({
          user_id: campaign.user_id,
          email: recipient.email,
          reason: suppressionReason,
          source: "Brevo webhook"
        }, { onConflict: "user_id,email" });
        if (suppressionError) throw suppressionError;

        if (recipient.contact_id) {
          const contactUpdate: { status: string; consent_status?: string } = {
            status: eventType === "unsubscribe" ? "unsubscribed" : eventType === "complaint" ? "complained" : "bounced"
          };
          // Preserve the historical consent confirmation for bounces/complaints;
          // only an explicit unsubscribe withdraws consent.
          if (eventType === "unsubscribe") contactUpdate.consent_status = "withdrawn";
          const { error: contactError } = await supabase.from("contacts")
            .update(contactUpdate)
            .eq("id", recipient.contact_id)
            .eq("user_id", campaign.user_id);
          if (contactError) throw contactError;
        }
      }

      processed++;
    }

    return NextResponse.json({ received: events.length, processed });
  } catch {
    // A non-2xx response allows the provider to retry a partially processed batch.
    return NextResponse.json({ error: "Webhook processing failed. The provider may retry this batch." }, { status: 503 });
  }
}
