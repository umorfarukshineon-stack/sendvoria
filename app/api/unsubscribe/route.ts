import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    ? `<p>Confirm that you want to stop receiving marketing emails.</p><form method="post" action="/api/unsubscribe"><input type="hidden" name="token" value="${safeToken}"><button type="submit">Unsubscribe</button></form>`
    : `<p>${message}</p>`;
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Sendvoria</title><body style="font:16px Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#17221f"><h1>Sendvoria email preferences</h1>${content}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return page("This unsubscribe link is invalid.", "", false);
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
    const form = await request.formData();
    token = String(form.get("token") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(token)) return page("This unsubscribe link is invalid.", "", false);
    const supabase = adminClient();
    const { data: contact, error: lookupError } = await supabase.from("contacts").select("id,user_id,email").eq("unsubscribe_token", token).maybeSingle();
    if (lookupError || !contact) return page("This unsubscribe link is invalid or has expired.", "", false);
    const { error: updateError } = await supabase.from("contacts").update({ status: "unsubscribed", consent_status: "withdrawn" }).eq("id", contact.id);
    if (updateError) throw updateError;
    const { error: suppressionError } = await supabase.from("suppression_list").upsert({
      user_id: contact.user_id, email: contact.email, reason: "unsubscribe", source: "Sendvoria one-click unsubscribe"
    }, { onConflict: "user_id,email" });
    if (suppressionError) throw suppressionError;
    return page("You have been unsubscribed successfully. We will not send you further marketing emails from this workspace.", "", false);
  } catch {
    return page("We could not process your request right now. Please try again later.", token, true);
  }
}
