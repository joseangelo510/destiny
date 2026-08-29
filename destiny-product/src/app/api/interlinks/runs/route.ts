import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  buildInterlinkInventory,
  fetchInterlinkPage,
  findInterlinkOpportunities,
  isSafePublicWebsiteUrl,
  reconcileFreshOpportunityState,
  type InterlinkPageSnapshot,
} from "@/lib/seo/interlinking";

export const maxDuration = 300;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const pageRole = (value: unknown): "homepage" | "product" | "how_it_works" | "about" | "contact" | "other" => value === "homepage" || value === "product" || value === "how_it_works" || value === "about" || value === "contact" ? value : "other";

async function fetchInBatches<T, R>(values: T[], size: number, worker: (value: T) => Promise<R>) {
  const output: R[] = [];
  for (let index = 0; index < values.length; index += size) output.push(...await Promise.all(values.slice(index, index + size).map(worker)));
  return output;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { websiteId?: unknown };
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  if (!websiteId) return NextResponse.json({ error: "Choose a website before checking internal links." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;
  const { data: website } = await supabase.from("websites").select("id,organization_id,url,normalized_domain").eq("id", websiteId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  if (!isSafePublicWebsiteUrl(website.url)) return NextResponse.json({ error: "Rebound SEO can only check public website URLs." }, { status: 422 });
  const { data: audit } = await supabase.from("audits").select("id").eq("website_id", website.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!audit) return NextResponse.json({ error: "Complete a website audit before checking internal links." }, { status: 422 });

  const [{ data: metrics }, { data: publishedRows }] = await Promise.all([
    supabase.from("audit_metrics").select("raw_provider_payload").eq("audit_id", audit.id).maybeSingle(),
    db.from("publishing_schedule_items").select("remote_permalink,title").eq("website_id", website.id).eq("state", "published").not("remote_permalink", "is", null).limit(50),
  ]);
  const providerResult = record(record(metrics?.raw_provider_payload).providerResult);
  const auditPages = list(providerResult.pages).map(record).flatMap((page) => typeof page.url === "string" ? [{
    url: page.url,
    title: typeof page.title === "string" ? page.title : "",
    text: typeof page.text === "string" ? page.text : "",
    role: pageRole(page.role),
  }] : []);
  const keywords = list(providerResult.keywords).map(record).flatMap((keyword) => typeof keyword.keyword === "string" && typeof keyword.url === "string" ? [{
    keyword: keyword.keyword,
    url: keyword.url,
    rank: Number(keyword.rank ?? 0),
    searchVolume: Number(keyword.searchVolume ?? 0),
  }] : []);
  const publishedPages = (publishedRows ?? []).flatMap((row) => typeof row.remote_permalink === "string" ? [{ url: row.remote_permalink, title: typeof row.title === "string" ? row.title : "" }] : []);
  const inventory = buildInterlinkInventory({ websiteUrl: website.url, auditPages, keywords, publishedPages });
  if (inventory.length < 2) return NextResponse.json({
    error: "Rebound SEO has fewer than two verified pages for this website. Run a fresh audit or publish content before checking for links.",
  }, { status: 422 });

  const snapshots = await fetchInBatches(inventory, 5, (page) => fetchInterlinkPage(page, website.url));
  const checked = snapshots.filter((page) => page.statusCode === 200).length;
  if (checked < 2) return NextResponse.json({ error: "Rebound SEO could not read enough live pages to find safe internal-link opportunities." }, { status: 502 });
  const opportunities = findInterlinkOpportunities(snapshots, website.url);
  const runId = randomUUID();
  const completedAt = new Date().toISOString();
  const runRow = {
    id: runId,
    organization_id: website.organization_id,
    website_id: website.id,
    audit_id: audit.id,
    user_id: userId,
    status: "complete",
    pages_checked: checked,
    manifest: {
      version: 1,
      scope: "verified_priority_pages",
      inventoryCount: inventory.length,
      pages: snapshots.map((page: InterlinkPageSnapshot) => ({
        ...page,
        text: page.text.slice(0, 20_000),
        links: page.links.slice(0, 100),
      })),
      failures: snapshots.filter((page) => page.statusCode !== 200).map((page) => ({ url: page.url, statusCode: page.statusCode })),
    },
    completed_at: completedAt,
  };
  const { error: runError } = await db.from("interlink_runs").insert(runRow);
  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

  const { data: existingRows } = opportunities.length
    ? await db.from("interlink_opportunities").select("id,source_url,target_url,status,skip_reason,verified_at,verified_anchor").eq("website_id", website.id)
    : { data: [] };
  const existing = new Map((existingRows ?? []).map((row) => [`${row.source_url}\n${row.target_url}`, row]));
  const opportunityRows = opportunities.map((opportunity) => {
    const previous = existing.get(`${opportunity.sourceUrl}\n${opportunity.targetUrl}`);
    const reconciled = reconcileFreshOpportunityState(previous ? { status: previous.status, verifiedAt: previous.verified_at, verifiedAnchor: previous.verified_anchor } : null);
    return {
      id: previous?.id ?? randomUUID(),
      run_id: runId,
      organization_id: website.organization_id,
      website_id: website.id,
      source_url: opportunity.sourceUrl,
      source_title: opportunity.sourceTitle,
      target_url: opportunity.targetUrl,
      target_title: opportunity.targetTitle,
      anchor_text: opportunity.anchorText,
      source_sentence: opportunity.sourceSentence,
      reason: opportunity.reason,
      priority_score: opportunity.score,
      priority: opportunity.priority,
      status: reconciled.status,
      skip_reason: previous?.skip_reason ?? null,
      verified_at: reconciled.verifiedAt,
      verified_anchor: reconciled.verifiedAnchor,
    };
  });
  if (opportunityRows.length) {
    const { error } = await db.from("interlink_opportunities").upsert(opportunityRows, { onConflict: "website_id,source_url,target_url" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    run: { id: runId, pagesChecked: checked, inventoryCount: inventory.length, completedAt, scope: "verified_priority_pages" },
    opportunities: opportunityRows.map((row) => ({
      id: row.id,
      sourceUrl: row.source_url,
      sourceTitle: row.source_title,
      targetUrl: row.target_url,
      targetTitle: row.target_title,
      anchorText: row.anchor_text,
      sourceSentence: row.source_sentence,
      reason: row.reason,
      priority: row.priority,
      score: row.priority_score,
      status: row.status,
      verifiedAt: row.verified_at,
      verifiedAnchor: row.verified_anchor,
    })),
  });
}
