import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidUnsubscribeToken, resolveUnsubscribeToken } from "@/lib/email/unsubscribe-token.js";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Unsubscribe service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function page(message: string, token: string, showForm: boolean) {
  const safeToken = encodeURIComponent(token);
  const content = showForm
    ? `<p>Confirm that you want to stop receiving marketing emails.</p><form method="post" action="/api/unsubscribe?token=${safeToken}"><input type="hidden" name="token" value="${safeToken}"><button type="submit">Unsubscribe</button></form>`
    : `<p>${message}</p>`;
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Sendvoria</title><body style="font:16px Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#17221f"><h1>Sendvoria email preferences</h1>${content}</body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer"
    }
  });
}

export async function GET(request: NextRequest) {
  const token = resolveUnsubscribeToken(request.url);
  if (!isValidUnsubscribeToken(token)) return page("This unsubscribe link is invalid.", "", false);
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.from("contacts").select("id").eq("unsubscribe_token", token).maybeSingle();
    if (error || !data) return page("This unsubscribe link is invalid or has expired.", "", false);
    // GET only displays a confirmation page. Mail security scanners must not unsubscribe users.
    return page("", token, true);
  } catch {
    return page("Email preferences are temporarily unavailable. Please try again later.", "", false);
  }
}

export async function POST(request: NextRequest) {
  let token = "";
  try {
    let formToken = "";
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      try {
        const form = await request.formData();
        formToken = String(form.get("token") ?? "");
      } catch {
        // RFC 8058 one-click requests carry the token in the URL and may not
        // include the browser confirmation form's hidden token field.
      }
    }

    // RFC 8058 clients POST to the List-Unsubscribe URL, so the token is in
    // the query string and the body contains List-Unsubscribe=One-Click.
    // Browser confirmation forms continue to work through the form-token fallback.
    token = resolveUnsubscribeToken(request.url, formToken);
    if (!isValidUnsubscribeToken(token)) return page("This unsubscribe link is invalid.", "", false);

    const supabase = adminClient();
    const { data: contact, error: lookupError } = await supabase
      .from("contacts")
      .select("id,user_id,email,status")
      .eq("unsubscribe_token", token)
      .maybeSingle();
    if (lookupError || !contact) return page("This unsubscribe link is invalid or has expired.", "", false);

    const { error: updateError } = await supabase.from("contacts")
      .update({ status: "unsubscribed", consent_status: "withdrawn" })
      .eq("id", contact.id)
      .eq("user_id", contact.user_id);
    if (updateError) throw updateError;

    const { error: suppressionError } = await supabase.from("suppression_list").upsert({
      user_id: contact.user_id,
      email: contact.email,
      reason: "unsubscribe",
      source: "Sendvoria one-click unsubscribe"
    }, { onConflict: "user_id,email" });
    if (suppressionError) throw suppressionError;

    return page("You have been unsubscribed successfully. We will not send you further marketing emails from this workspace.", "", false);
  } catch {
    return page("We could not process your request right now. Please try again later.", token, isValidUnsubscribeToken(token));
  }
}
