import { NextResponse } from "next/server";
import { prepareWordPressDraft, type WordPressDraftRequest } from "@/lib/cms/wordpress-draft";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import sharp from "sharp";
import { wordpressRemoteIdFromEditUrl } from "@/lib/content/publishing-plan";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

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

  const media = await Promise.all([draft.featuredGraphic, ...draft.graphics].map(async (graphic) => {
    const binary = await sharp(Buffer.from(graphic.svg)).webp({ quality: 88 }).toBuffer();
    return {
      filename: `${graphic.name}.webp`,
      mimeType: "image/webp",
      base64: binary.toString("base64"),
      alt: graphic.alt,
      role: graphic.role,
      caption: graphic.caption,
      placementAfterHeading: graphic.placementAfterHeading,
    };
  }));

  const { data, error } = await supabase.functions.invoke<{
    delivered?: boolean;
    remoteEditUrl?: string;
    error?: string;
  }>("wordpress-draft", { body: { ...draft, featuredGraphic: undefined, graphics: undefined, media } });

  if (error || !data?.delivered || !data.remoteEditUrl) {
    return NextResponse.json({ error: data?.error || "Destiny could not create the WordPress draft." }, { status: 502 });
  }
  if (draft.scheduledFor) {
    const db = supabase as unknown as SupabaseClient;
    await db.from("publishing_schedule_items").update({
      state: "scheduled",
      article_key: draft.articleKey,
      remote_id: wordpressRemoteIdFromEditUrl(data.remoteEditUrl),
      remote_edit_url: data.remoteEditUrl,
      last_error: null,
    }).eq("website_id", draft.websiteId).eq("normalized_keyword", normalizeTrackedKeyword(String(body.keyword ?? ""))).eq("scheduled_for", draft.scheduledFor);
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
