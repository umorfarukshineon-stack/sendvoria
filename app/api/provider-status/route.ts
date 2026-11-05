import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const sender = process.env.EMAIL_FROM_ADDRESS || "";
    const hasKey = Boolean(process.env.BREVO_API_KEY);
    const hasSender = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender);
    const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const domainVerified = process.env.SENDER_DOMAIN_VERIFIED === "true";
    const liveSendingEnabled = process.env.SENDVORIA_LIVE_SENDING_ENABLED === "true";
    return NextResponse.json({
      provider: "Brevo",
      apiKeyConfigured: hasKey,
      senderConfigured: hasSender,
      senderAddress: hasSender ? sender : null,
      unsubscribeServiceConfigured: hasServiceRole,
      domainVerified,
      liveSendingEnabled,
      sendingReady: hasKey && hasSender && hasServiceRole && domainVerified && liveSendingEnabled,
      dailyFreePlanLimit: 300,
      requiredEnvironmentVariables: ["BREVO_API_KEY", "EMAIL_FROM_ADDRESS", "EMAIL_FROM_NAME", "SUPABASE_SERVICE_ROLE_KEY", "SENDER_DOMAIN_VERIFIED", "SENDVORIA_LIVE_SENDING_ENABLED"],
      domainVerification: "Must be confirmed in Brevo before sending. Sendvoria cannot verify DNS records automatically."
    });
  } catch {
    return NextResponse.json({ error: "Could not check integration status." }, { status: 503 });
  }
}
