import { NextResponse } from "next/server";

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const emailProviderConfigured = Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS);

  return NextResponse.json({
    app: "Sendvoria",
    status: "ok",
    integrations: {
      supabase: supabaseConfigured ? "configured" : "not_configured",
      emailProvider: emailProviderConfigured ? "configured" : "not_configured"
    },
    note: "Health status does not imply that campaign sending is enabled."
  });
}
