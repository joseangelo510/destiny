import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id,kind,title,body,destination_path,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notifications: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const body = await request.json() as { id?: unknown; all?: unknown };
  const query = supabase.from("notifications").update({ read_at: new Date().toISOString() });
  const { error } = body.all === true
    ? await query.is("read_at", null)
    : typeof body.id === "string"
      ? await query.eq("id", body.id)
      : { error: new Error("Choose a notification to mark as read.") };

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
