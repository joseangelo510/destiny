import { renderArticleMarkdownToHtml } from "@/lib/content/article-draft";
import { infographicPlanIssues, type InfographicPlan } from "@/lib/content/infographic-generation";
import { createClient } from "@/lib/supabase/server";
import { createDocxFromHtml, safeDocumentName } from "@/lib/word-document";
import { isWebsiteId } from "@/lib/workspace-selection";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function plan(value: unknown): InfographicPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<InfographicPlan>;
  if (!candidate.title?.trim() || !candidate.article?.markdown?.trim() || !Array.isArray(candidate.sections) || !Array.isArray(candidate.sources) || !Array.isArray(candidate.repurposeCards)) return null;
  return candidate as InfographicPlan;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { websiteId?: unknown; plan?: unknown };
  if (!isWebsiteId(payload.websiteId)) return Response.json({ error: "Choose the website for this document." }, { status: 400 });
  const infographicPlan = plan(payload.plan);
  if (!infographicPlan) return Response.json({ error: "Research the infographic before downloading its article." }, { status: 400 });
  const issues = infographicPlanIssues(infographicPlan, new Set(infographicPlan.sources.map((source) => source.url)));
  if (issues.length) return Response.json({ error: issues[0] }, { status: 400 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return Response.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id").eq("id", payload.websiteId).maybeSingle();
  if (!website) return Response.json({ error: "That website is not available in this account." }, { status: 404 });

  const sources = infographicPlan.sources.map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a> — ${escapeHtml(source.publisher)} (${escapeHtml(source.publishedAt)})</li>`).join("");
  const reusablePosts = infographicPlan.repurposeCards.map((card) => `<h3>${escapeHtml(card.title)}</h3><p><strong>Recommended channel:</strong> ${escapeHtml(card.recommendedChannel)}</p><p>${escapeHtml(card.copy)}</p>`).join("");
  const html = `<main><p><strong>SEO/meta title:</strong> ${escapeHtml(infographicPlan.article.metaTitle)}</p><p><strong>Meta description:</strong> ${escapeHtml(infographicPlan.article.metaDescription)}</p><p><strong>Infographic alt text:</strong> ${escapeHtml(infographicPlan.altText)}</p><hr/>${renderArticleMarkdownToHtml(infographicPlan.article.markdown)}<h2>Sources</h2><ol>${sources}</ol><h2>Four reusable posts</h2>${reusablePosts}</main>`;
  const document = await createDocxFromHtml(html, infographicPlan.article.title);
  return new Response(new Uint8Array(document), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeDocumentName(infographicPlan.article.title, "destiny-infographic-article")}.docx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  });
}
