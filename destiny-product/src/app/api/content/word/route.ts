import { NextResponse } from "next/server";
import { buildWordDocument, type ArticleDraft } from "@/lib/content/article-draft";
import { createClient } from "@/lib/supabase/server";
import { isWebsiteId } from "@/lib/workspace-selection";
import { createDocxFromHtml, safeDocumentName } from "@/lib/word-document";

function articleDraft(value: unknown): ArticleDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Partial<ArticleDraft>;
  if (typeof draft.keyword !== "string" || typeof draft.title !== "string" || typeof draft.body !== "string") return null;
  if (!draft.keyword.trim() || !draft.title.trim() || !draft.body.trim() || draft.body.length > 500_000) return null;
  return {
    keyword: draft.keyword,
    title: draft.title,
    body: draft.body,
    metaDescription: typeof draft.metaDescription === "string" ? draft.metaDescription : "",
    metaDescriptions: Array.isArray(draft.metaDescriptions) ? draft.metaDescriptions.filter((item): item is string => typeof item === "string").slice(0, 2) : [],
    sources: Array.isArray(draft.sources) ? draft.sources : [],
    infographics: Array.isArray(draft.infographics) ? draft.infographics : [],
    bucketBrigades: Array.isArray(draft.bucketBrigades) ? draft.bucketBrigades : [],
    preferences: draft.preferences as ArticleDraft["preferences"],
    generationStatus: "generated",
    generatedBy: draft.generatedBy,
    qualityIssues: [],
    optimization: [],
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { websiteId?: unknown; draft?: unknown };
  if (!isWebsiteId(payload.websiteId)) return NextResponse.json({ error: "Choose the website for this document." }, { status: 400 });
  const draft = articleDraft(payload.draft);
  if (!draft) return NextResponse.json({ error: "This article is incomplete and cannot be exported yet." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id").eq("id", payload.websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "That website is not available in this account." }, { status: 404 });

  const document = await createDocxFromHtml(buildWordDocument(draft), draft.title);
  return new Response(new Uint8Array(document), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeDocumentName(draft.keyword, "destiny-article")}.docx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
