import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";
import { createDraft } from "@/lib/drafts/createDraft";
import { normalizeTrackedKeyword } from "@/lib/seo/rank-tracker";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_TYPES = new Set(["Blog guide / FAQ", "Service landing page", "Comparison page"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
  const auditId = typeof body.auditId === "string" ? body.auditId : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!UUID.test(websiteId) || !UUID.test(auditId) || !keyword || keyword.length > 300) return NextResponse.json({ error: "Choose a valid website, audit and keyword." }, { status: 400 });
  const client = await scopedClient(websiteId);
  const userId = await client.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to create content." }, { status: 401 });
  const [{ data: website, error: websiteError }, { data: audit, error: auditError }, { data: preference, error: preferenceError }] = await Promise.all([
    client.website("organization_id,ideal_customer").maybeSingle(),
    client.select("audits", "id,requested_by").eq("id", auditId).maybeSingle(),
    client.select("keyword_preferences", "keyword,decision,search_volume").eq("normalized_keyword", normalizeTrackedKeyword(keyword)).maybeSingle(),
  ]);
  if (websiteError || auditError || !website || !audit || audit.requested_by !== userId) return NextResponse.json({ error: "The website or audit is not available to this account." }, { status: 404 });
  if (preferenceError || preference?.decision !== "approved" || Number(preference.search_volume ?? 0) <= 0) return NextResponse.json({ error: "Approve a measured keyword before creating content." }, { status: 409 });
  const savedKeyword = String(preference.keyword);
  const pageType = PAGE_TYPES.has(body.pageType) ? String(body.pageType) : "Blog guide / FAQ";
  try {
    const draft = await createDraft(client, { userId, organizationId: website.organization_id, websiteId, auditId }, {
      title: savedKeyword,
      targetKeyword: savedKeyword,
      angle: `${pageType} about ${savedKeyword}, for ${String(website.ideal_customer || "your customers")}.`,
      outlineBullets: [],
      writingInstructions: `Create a ${pageType.toLowerCase()} focused on “${savedKeyword}”. Use the saved business context and verify factual claims before publication.`,
    });
    return NextResponse.json({ ...draft, url: `/content?site=${encodeURIComponent(websiteId)}&keyword=${encodeURIComponent(savedKeyword)}#article-review-workspace` });
  } catch {
    return NextResponse.json({ error: "Your keyword is approved, but its draft could not be saved. Try again from Approved; existing drafts are kept." }, { status: 500 });
  }
}
