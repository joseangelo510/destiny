import { NextResponse } from "next/server";
import { prepareWordPressDraft, type WordPressDraftRequest } from "@/lib/cms/wordpress-draft";
import { scopedClient } from "@/lib/db";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import sharp from "sharp";
import { wordpressRemoteIdFromEditUrl } from "@/lib/content/publishing-plan";

export async function POST(request: Request) {
  let body: WordPressDraftRequest;
  try {
    body = await request.json() as WordPressDraftRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const db = await scopedClient(String(body.websiteId ?? ""));
  if (!await db.getClaims()) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

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

  const { data, error } = await db.invokeFunction<{
    delivered?: boolean;
    remoteEditUrl?: string;
    error?: string;
  }>("wordpress-draft", { ...draft, featuredGraphic: undefined, graphics: undefined, media });

  if (error || !data?.delivered || !data.remoteEditUrl) {
    return NextResponse.json({ error: data?.error || "Rebound SEO could not create the WordPress draft." }, { status: 502 });
  }
  if (draft.scheduledFor) {
    await db.update("publishing_schedule_items", {
      state: "scheduled",
      article_key: draft.articleKey,
      remote_id: wordpressRemoteIdFromEditUrl(data.remoteEditUrl),
      remote_edit_url: data.remoteEditUrl,
      last_error: null,
    }, {
      normalized_keyword: normalizeTrackedKeyword(String(body.keyword ?? "")),
      scheduled_for: draft.scheduledFor,
    });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
