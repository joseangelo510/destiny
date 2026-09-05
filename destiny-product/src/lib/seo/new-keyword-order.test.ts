import { expect, it } from "vitest";
import { deterministicBusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import { hasContentAngle, orderNewContentTopics, sameContentTopic } from "./new-keyword-order";
import { type RankedKeywordOpportunity } from "./keyword-opportunity";
const business = { productsServices: "SEO services, Google Ads campaign management and conversion rate optimization", idealCustomer: "B2B SaaS companies" };
const brief = deterministicBusinessSearchBrief(business);
brief.offerVsEnablement.whatCompanySells = ["SEO services", "Google Ads campaign management", "Conversion rate optimization services"];
it("keeps useful content angles and removes agency variants, boilerplate and exam fragments", () => {
  for (const keyword of ["seo services near me", "seo agency interamplify", "conversion rate optimization tool", "theo is looking to improve his google search ads campaign"]) expect(hasContentAngle(keyword, brief)).toBe(false);
  for (const keyword of ["google ads campaign budget", "conversion rate optimization audit", "how much does seo cost"]) expect(hasContentAngle(keyword, brief)).toBe(true);
});
it("does not count free checklists or reordered pricing variants as additional options", () => {
  expect(sameContentTopic("free conversion rate optimization checklist", "conversion rate optimization checklist", brief)).toBe(true);
  expect(sameContentTopic("cost for seo services", "seo services pricing", brief)).toBe(true);
  expect(sameContentTopic("google ads campaign budget", "google ads campaign structure", brief)).toBe(false);
});
it("interleaves business themes before considering the next high-volume phrase", () => {
  const candidates = ["seo audit", "seo checklist", "seo strategy", "google ads campaign budget", "conversion rate optimization audit"].map((keyword, i) => ({ keyword, searchVolume: 1000 - i * 100, intent: "informational", opportunity: "site_idea" }));
  const ranked = candidates.map(candidate => ({ ...candidate, themeId: "source", themeLabel: "Source", themeRole: "awareness", providerIntent: "informational", searchIntent: "awareness", priorityScore: 70, priorityTier: 4, priorityReason: "Measured topic", businessFit: 0.7, revenueFit: 0.2, relevanceTier: "adjacent" })) as RankedKeywordOpportunity[];
  const result = orderNewContentTopics(ranked, brief);
  expect(new Set(result.slice(0, 3).map(keyword => keyword.themeId)).size).toBe(3);
});
