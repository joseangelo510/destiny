import { NextResponse } from "next/server";
import { prepareWebflowDraft, type WebflowDraftRequest } from "@/lib/cms/webflow-draft";
import { scopedClient } from "@/lib/db";

export async function POST(request: Request) {
  let body: WebflowDraftRequest;
  try {
    body = await request.json() as WebflowDraftRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const db = await scopedClient(String(body.websiteId ?? ""));
  if (!await db.getClaims()) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  let draft: ReturnType<typeof prepareWebflowDraft>;
  try {
    draft = prepareWebflowDraft(body);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Review the article before sending it." }, { status: 400 });
  }

  const { data, error } = await db.invokeFunction<{
    delivered?: boolean;
    remoteEditUrl?: string;
    updated?: boolean;
    reused?: boolean;
    fieldReport?: Array<{ field: string; label: string; status: string; note: string }>;
    error?: string;
  }>("webflow-draft", draft);

  if (error || !data?.delivered || !data.remoteEditUrl) {
    return NextResponse.json({ error: data?.error || "Destiny could not create the Webflow draft item." }, { status: 502 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
