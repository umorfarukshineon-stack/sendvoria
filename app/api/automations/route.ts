import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const triggers = new Set(["welcome", "product_click", "birthday", "inactivity", "manual"]);

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await supabase.from("automations").select("id,name,trigger_type,is_active,configuration,created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ automations: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automations service unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const triggerType = String(body.trigger_type ?? "manual");
    if (!name || !triggers.has(triggerType)) return NextResponse.json({ error: "A name and valid trigger_type are required." }, { status: 400 });
    const { data, error } = await supabase.from("automations").insert({
      user_id: user.id, name, trigger_type: triggerType,
      is_active: false,
      configuration: body.configuration && typeof body.configuration === "object" ? body.configuration : {}
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ automation: data, note: "Automations are saved inactive until trigger execution and compliance checks are configured." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automation save failed" }, { status: 503 });
  }
}
