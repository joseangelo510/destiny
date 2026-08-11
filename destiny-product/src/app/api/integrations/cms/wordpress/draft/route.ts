import { NextResponse } from "next/server";
import { prepareWordPressDraft, type WordPressDraftRequest } from "@/lib/cms/wordpress-draft";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: WordPressDraftRequest;
  try {
    body = await request.json() as WordPressDraftRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let draft: ReturnType<typeof prepareWordPressDraft>;
  try {
    draft = prepareWordPressDraft(body);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Review the article before sending it." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    delivered?: boolean;
    remoteEditUrl?: string;
    error?: string;
  }>("wordpress-draft", { body: draft });

  if (error || !data?.delivered || !data.remoteEditUrl) {
    return NextResponse.json({ error: data?.error || "Destiny could not create the WordPress draft." }, { status: 502 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
