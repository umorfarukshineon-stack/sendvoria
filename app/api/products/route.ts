import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data, error } = await supabase.from("products").select("id,name,description,image_url,price,currency,external_url,is_active,created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ products: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Products service unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const externalUrl = String(body.external_url ?? "").trim();
    if (!name || name.length > 180) return NextResponse.json({ error: "A product name (max 180 characters) is required." }, { status: 400 });
    try { if (new URL(externalUrl).protocol !== "https:") throw new Error(); }
    catch { return NextResponse.json({ error: "Product URL must be a valid HTTPS link to your external store." }, { status: 400 }); }
    const { data, error } = await supabase.from("products").insert({
      user_id: user.id, name, external_url: externalUrl,
      description: body.description ? String(body.description).slice(0, 5000) : null,
      image_url: body.image_url ? String(body.image_url) : null,
      price: body.price === null || body.price === undefined || body.price === "" ? null : Number(body.price),
      currency: String(body.currency ?? "USD").toUpperCase().slice(0, 3)
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Product save failed" }, { status: 503 });
  }
}
