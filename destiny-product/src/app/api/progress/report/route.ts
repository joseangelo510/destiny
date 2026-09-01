import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validId(value: unknown) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = validId(body.websiteId);
  const requestId = validId(body.requestId);
  if (!websiteId || !requestId) return NextResponse.json({ error: "Choose a valid website and report request." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to send the report." }, { status: 401 });
  const { data: website, error: websiteError } = await db.website("id").maybeSingle();
  if (websiteError || !website) return NextResponse.json({ error: "You do not have access to that website." }, { status: 403 });

  const { data, error } = await db.invokeFunction<{ status?: unknown; messageId?: unknown; error?: unknown; reason?: unknown }>("progress-report", { websiteId, requestId });
  if (error) return NextResponse.json({ error: error.message || "Rebound SEO could not send the progress report." }, { status: 502 });
  if (data?.status !== "accepted" || typeof data.messageId !== "string") {
    const message = typeof data?.error === "string" ? data.error : typeof data?.reason === "string" ? data.reason : "Rebound SEO could not send the progress report.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  return NextResponse.json({ status: "accepted", messageId: data.messageId }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
