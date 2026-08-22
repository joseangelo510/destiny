import { NextResponse } from "next/server";
import { prepareWebflowToken } from "@/lib/cms/webflow";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  action?: unknown;
  websiteId?: unknown;
  apiToken?: unknown;
  siteId?: unknown;
  collectionId?: unknown;
  bodyField?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.websiteId !== "string" || !body.websiteId) {
    return NextResponse.json({ error: "Complete onboarding before connecting Webflow." }, { status: 400 });
  }
  try {
    prepareWebflowToken(body.apiToken);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Check the Webflow API token." }, { status: 400 });
  }
  const action = body.action === "connect" ? "connect" : "discover";
  if (action === "connect" && (typeof body.collectionId !== "string" || !body.collectionId || typeof body.siteId !== "string" || !body.siteId)) {
    return NextResponse.json({ error: "Choose the Webflow site and CMS collection for approved articles." }, { status: 400 });
  }

  const { data, error } = await supabase.functions.invoke<{
    verified?: boolean;
    connected?: boolean;
    sites?: unknown[];
    siteName?: string;
    collectionName?: string;
    bodyFieldLabel?: string;
    error?: string;
  }>("webflow-connect", {
    body: {
      action,
      websiteId: body.websiteId,
      apiToken: body.apiToken,
      siteId: body.siteId,
      collectionId: body.collectionId,
      bodyField: body.bodyField,
    },
  });
  if (error || (!data?.verified && !data?.connected)) {
    return NextResponse.json({ error: data?.error || "Webflow could not be connected. Check the site API token." }, { status: 502 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
