export async function seedKeywordDepthWorkspaces({ createWebsite, seedMvpCertification, member, organizationId, service }) {
  const workspaces = {};
  const topics = ["crawl budget", "site migrations", "conversion tracking", "redirect chains", "canonical tags", "structured data", "page speed", "content decay", "internal links", "search intent", "mobile indexing", "content pruning", "duplicate content", "image performance", "rank reporting", "keyword mapping", "log analysis", "site architecture", "index coverage", "link equity", "content planning", "traffic attribution", "metadata testing", "navigation design", "landing page testing", "schema validation", "sitemap maintenance", "content quality", "page rendering", "international targeting", "search forecasting"];
  for (const device of ["desktop", "mobile"]) {
    const site = await createWebsite(member.client, organizationId, `Keyword-depth-${device}`, member.userId);
    const scenario = await seedMvpCertification({ auditId: site.auditIds.at(-1), organizationId, ownerId: member.userId, websiteId: site.websiteId });
    const { data: metric } = await service.from("audit_metrics").select("raw_provider_payload").eq("audit_id", scenario.auditId).single();
    const raw = metric.raw_provider_payload;
    raw.providerResult.keywords.push(...topics.map(topic => ({ keyword: `seo ${topic} guide`, intent: "informational", searchVolume: 100, difficulty: 25, cpc: 3, opportunity: "site_idea", priorityScore: 60, priorityReason: "Disposable QA fixture: supporting SEO topic", themeId: "seo-audits", themeLabel: "SEO audits", themeRole: "awareness" })));
    const { error } = await service.from("audit_metrics").update({ raw_provider_payload: raw }).eq("audit_id", scenario.auditId);
    if (error) throw new Error(`Keyword depth fixture failed: ${error.message}`);
    workspaces[device] = scenario;
  }
  return workspaces;
}
