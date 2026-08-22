import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReoptimizationManifest, fetchReoptimizationPage } from "@/lib/seo/reoptimization-document";
import { applyVerifiedInternalLinkPlan, buildAnthropicReoptimizationRequest, buildReoptimizationEvidencePack, buildReoptimizationPrompt, parseReoptimizationStrategy } from "@/lib/seo/reoptimization-strategy";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";
import { getResearchClient } from "@/lib/seo/research";
import { DEFAULT_COPY_MODEL } from "@/lib/content/article-generation";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const anthropicText = (payload: unknown) => Array.isArray(record(payload).content) ? (record(payload).content as unknown[]).map(record).filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text as string).join("\n") : "";
const normalizedHost = (value: string) => new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { auditId?: unknown; keyword?: unknown; regenerate?: unknown };
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 500) : "";
  const regenerate = body.regenerate === true;
  if (!auditId || !keyword) return NextResponse.json({ error: "Choose a valid keyword and audit." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const normalizedKeyword = normalizeTrackedKeyword(keyword);

  const { data: audit } = await supabase.from("audits").select("id,website_id,requested_by").eq("id", auditId).maybeSingle();
  if (!audit || audit.requested_by !== userId) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  const { data: website } = await supabase.from("websites").select("id,organization_id,business_name,url,products_services,ideal_customer").eq("id", audit.website_id).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });

  const { data: existing } = await db.from("reoptimization_documents").select("id,manifest").eq("audit_id", auditId).eq("normalized_keyword", normalizedKeyword).maybeSingle();
  if (existing?.id && record(existing.manifest).version === 4 && !regenerate) return NextResponse.json({ document: { id: existing.id, url: `/reoptimization/${existing.id}`, downloadUrl: `/api/reoptimization-documents/${existing.id}/download` }, reused: true });

  const { data: metrics } = await supabase.from("audit_metrics").select("raw_provider_payload").eq("audit_id", auditId).maybeSingle();
  const providerResult = record(record(metrics?.raw_provider_payload).providerResult);
  const providerKeywords = Array.isArray(providerResult.keywords) ? providerResult.keywords.map(record) : [];
  const verifiedInternalPages = Array.isArray(providerResult.pages) ? providerResult.pages.map(record).flatMap((page) => typeof page.url === "string" ? [{ title: typeof page.title === "string" ? page.title : page.url, url: page.url, text: typeof page.text === "string" ? page.text.slice(0, 8_000) : "" }] : []) : [];
  const evidence = providerKeywords.find((candidate) => normalizeTrackedKeyword(String(candidate.keyword || "")) === normalizedKeyword) ?? {};
  const { data: searchConsole } = await supabase.from("integrations").select("metadata").eq("website_id", website.id).eq("provider", "google_search_console").eq("status", "connected").maybeSingle();
  const topQueries = Array.isArray(record(searchConsole?.metadata).topQueries) ? record(searchConsole?.metadata).topQueries as unknown[] : [];
  const gsc = topQueries.map(record).find((query) => normalizeTrackedKeyword(String(query.query || "")) === normalizedKeyword) ?? {};
  const pageUrl = String(evidence.url || "").trim();
  if (!pageUrl) return NextResponse.json({ error: "Destiny did not verify an existing page for this keyword." }, { status: 422 });
  try {
    if (normalizedHost(pageUrl) !== normalizedHost(website.url)) return NextResponse.json({ error: "The ranked page does not belong to this website, so Destiny will not analyze it." }, { status: 422 });
  } catch { return NextResponse.json({ error: "Destiny did not receive a valid ranked page URL." }, { status: 422 }); }

  const evidenceInput = {
    auditId,
    websiteId: website.id,
    keyword,
    pageUrl,
    businessName: website.business_name,
    productsServices: website.products_services,
    idealCustomer: website.ideal_customer,
    searchVolume: Number(evidence.searchVolume ?? 0),
    rank: Number(evidence.rank ?? 0),
    gscPosition: Number(gsc.position ?? evidence.gscPosition ?? 0),
    gscImpressions: Number(gsc.impressions ?? evidence.gscImpressions ?? 0),
    gscClicks: Number(gsc.clicks ?? evidence.gscClicks ?? 0),
  };
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Evidence-backed re-optimization is not configured yet. Add ANTHROPIC_API_KEY to the server environment." }, { status: 503 });
  let snapshot;
  let research;
  try {
    [snapshot, research] = await Promise.all([
      fetchReoptimizationPage({ pageUrl, websiteUrl: website.url }),
      getResearchClient().reoptimizationResearch({ keyword, pageUrl, locationName: "United States" }),
    ]);
  } catch (cause) {
    console.error("reoptimization_research_failed", cause);
    return NextResponse.json({ error: "Destiny could not verify the live page and search landscape. Your keyword approval is saved; retry the change document without approving again." }, { status: 502 });
  }
  let strategy;
  const model = process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL;
  try {
    const prompt = buildReoptimizationPrompt(buildReoptimizationEvidencePack(evidenceInput, snapshot, research, verifiedInternalPages));
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(buildAnthropicReoptimizationRequest(prompt, model)),
      signal: AbortSignal.timeout(180_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(record(record(payload).error).message || `Claude returned HTTP ${response.status}.`));
    strategy = applyVerifiedInternalLinkPlan(parseReoptimizationStrategy(anthropicText(payload)), verifiedInternalPages, pageUrl, research.currentPage.text);
  } catch (cause) {
    console.error("reoptimization_strategy_failed", { model, cause });
    return NextResponse.json({ error: "Destiny could not produce a trustworthy evidence-backed plan. Your keyword approval is saved; retry the change document without approving again." }, { status: 502 });
  }
  const id = existing?.id ?? randomUUID();
  const manifest = buildReoptimizationManifest(evidenceInput, snapshot, research, strategy, id);
  const row = {
    id,
    organization_id: website.organization_id,
    website_id: website.id,
    audit_id: auditId,
    user_id: userId,
    keyword,
    normalized_keyword: normalizedKeyword,
    page_url: pageUrl,
    status: "active",
    manifest,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("reoptimization_documents").upsert(row, { onConflict: "audit_id,normalized_keyword" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: { id, url: `/reoptimization/${id}`, downloadUrl: `/api/reoptimization-documents/${id}/download` }, reused: false });
}
