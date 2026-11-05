import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await supabase.from("campaigns").select("id,name,subject,preview_text,status,scheduled_at,sent_at,created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ campaigns: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaigns service unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    if (!name || !subject) return NextResponse.json({ error: "Campaign name and subject are required." }, { status: 400 });
    const { data, error } = await supabase.from("campaigns").insert({
      user_id: user.id, name, subject,
      preview_text: body.preview_text ? String(body.preview_text).slice(0, 250) : null,
      html_content: body.html_content ? String(body.html_content) : null,
      text_content: body.text_content ? String(body.text_content) : null,
      audience_filter: body.audience_filter && typeof body.audience_filter === "object" ? body.audience_filter : {}
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign save failed" }, { status: 503 });
  }
}
