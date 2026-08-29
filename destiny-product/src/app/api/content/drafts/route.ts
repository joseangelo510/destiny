import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DRAFTS = 3;
const MAX_ARTICLE_CHARACTERS = 250_000;
const MAX_DRAFT_JSON_CHARACTERS = 500_000;

type SavedArticleDraft = Record<string, unknown> & {
  keyword: string;
  body: string;
  generationStatus?: unknown;
};

function id(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function draft(value: unknown): SavedArticleDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as SavedArticleDraft;
  if (typeof candidate.keyword !== "string" || !candidate.keyword.trim() || candidate.keyword.length > 300) return null;
  if (typeof candidate.body !== "string" || candidate.body.length > MAX_ARTICLE_CHARACTERS) return null;
  if (!new Set(["starter", "needs_generation", "generated"]).has(String(candidate.generationStatus ?? "starter"))) return null;
  if (JSON.stringify(candidate).length > MAX_DRAFT_JSON_CHARACTERS) return null;
  return candidate;
}

async function signedInUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const websiteId = id(url.searchParams.get("websiteId"));
  const auditId = id(url.searchParams.get("auditId"));
  if (!websiteId || !auditId) return NextResponse.json({ error: "Choose a valid website and audit." }, { status: 400 });

  const { supabase, userId } = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Sign in again to load article drafts." }, { status: 401 });
  const articleDrafts = (supabase as unknown as SupabaseClient).from("article_drafts");

  const { data, error } = await articleDrafts
    .select("draft")
    .eq("website_id", websiteId)
    .eq("audit_id", auditId);
  if (error) return NextResponse.json({ error: "Rebound SEO could not load the saved article drafts." }, { status: 500 });

  return NextResponse.json({ drafts: (data ?? []).map((row) => row.draft) });
}

export async function PUT(request: Request) {
  const { supabase, userId } = await signedInUserId();
  if (!userId) return NextResponse.json({ error: "Sign in again to save article drafts." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; auditId?: unknown; drafts?: unknown };
  const websiteId = id(body.websiteId);
  const auditId = id(body.auditId);
  const drafts = Array.isArray(body.drafts) ? body.drafts.slice(0, MAX_DRAFTS).map(draft) : [];
  if (!websiteId || !auditId || drafts.length === 0 || drafts.some((item) => !item)) {
    return NextResponse.json({ error: "Rebound SEO received an invalid article draft." }, { status: 400 });
  }

  const [{ data: website, error: websiteError }, { data: audit, error: auditError }] = await Promise.all([
    supabase.from("websites").select("organization_id").eq("id", websiteId).maybeSingle(),
    supabase.from("audits").select("id").eq("id", auditId).eq("website_id", websiteId).maybeSingle(),
  ]);
  if (websiteError || auditError || !website?.organization_id || !audit) {
    return NextResponse.json({ error: "The website or audit is not available to this account." }, { status: 404 });
  }

  const articleDrafts = (supabase as unknown as SupabaseClient).from("article_drafts");
  const { data: existingRows, error: existingError } = await articleDrafts
    .select("keyword,draft")
    .eq("website_id", websiteId)
    .eq("audit_id", auditId);
  if (existingError) {
    return NextResponse.json({ error: "Rebound SEO could not safely compare the saved article drafts." }, { status: 500 });
  }
  const generatedKeywords = new Set((existingRows ?? []).flatMap((row) => {
    const saved = row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)
      ? row.draft as Record<string, unknown>
      : null;
    return saved?.generationStatus === "generated" && typeof row.keyword === "string" ? [row.keyword] : [];
  }));
  const safeDrafts = (drafts as SavedArticleDraft[]).filter((item) => (
    item.generationStatus !== "starter" || !generatedKeywords.has(item.keyword.trim())
  ));
  const protectedCount = drafts.length - safeDrafts.length;

  const rows = safeDrafts.map((item) => ({
    organization_id: website.organization_id,
    website_id: websiteId,
    audit_id: auditId,
    user_id: userId,
    keyword: item.keyword.trim(),
    draft: item as Json,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return NextResponse.json({ saved: 0, protected: protectedCount });

  const { error } = await articleDrafts.upsert(rows, { onConflict: "website_id,audit_id,keyword" });
  if (error) return NextResponse.json({ error: "Rebound SEO generated the article but could not save it yet." }, { status: 500 });

  return NextResponse.json(protectedCount ? { saved: rows.length, protected: protectedCount } : { saved: rows.length });
}
