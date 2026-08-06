import { NextResponse } from "next/server";
import { prepareWordPressConnection } from "@/lib/cms/wordpress";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  websiteId?: unknown;
  siteUrl?: unknown;
  username?: unknown;
  applicationPassword?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.websiteId !== "string") {
    return NextResponse.json({ error: "Complete onboarding before connecting WordPress." }, { status: 400 });
  }
  try {
    prepareWordPressConnection({
      siteUrl: typeof body.siteUrl === "string" ? body.siteUrl : "",
      username: typeof body.username === "string" ? body.username : "",
      applicationPassword: typeof body.applicationPassword === "string" ? body.applicationPassword : "",
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Check the WordPress connection details." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ connected?: boolean; siteUrl?: string; displayName?: string; error?: string }>("wordpress-connect", {
    body: {
      websiteId: body.websiteId,
      siteUrl: body.siteUrl,
      username: body.username,
      applicationPassword: body.applicationPassword,
    },
  });
  if (error || !data?.connected) {
    return NextResponse.json({ error: data?.error || "WordPress could not be connected. Check the URL, username, and Application Password." }, { status: 502 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
