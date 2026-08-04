import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const body = await request.json() as { target?: unknown };
    if (typeof body.target !== "string") return NextResponse.json({ error: "Enter a public domain." }, { status: 400 });
    const { data, error } = await supabase.functions.invoke("seo-research", { body: { kind: "backlinks", target: body.target } });
    if (error || !data) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : error?.message || "Destiny could not complete backlink research.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Destiny could not complete backlink research.";
    const status = /configured/i.test(message) ? 503 : /valid public/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
