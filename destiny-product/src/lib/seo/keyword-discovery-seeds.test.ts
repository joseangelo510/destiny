import { expect, it } from "vitest";
import { keywordDiscoverySeeds } from "./keyword-discovery-seeds";
import { deterministicBusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
it("balances missing offers with problem, audience and technical seeds without company boilerplate", () => {
  const brief = deterministicBusinessSearchBrief({ productsServices: "SEO services and YouTube marketing", idealCustomer: "B2B SaaS companies", problemSolved: "Low website conversion rates", differentiation: "Specialization in AI automation" });
  brief.offerVsEnablement.whatCompanySells = ["SEO services", "YouTube marketing services", "GEO (generative engine optimization) services", "Conversion rate optimization services"];
  brief.audiences = ["B2B SaaS companies"];
  brief.problems = ["Low website conversion rates"];
  brief.differentiators = ["Specialization in AI automation", "Documented track record of success"];
  const seeds = keywordDiscoverySeeds(brief);
  expect(seeds).toEqual(expect.arrayContaining(["generative engine optimization", "conversion rate optimization", "low website conversion rates", "ai automation", "youtube marketing for b2b saas"]));
  expect(seeds.some(seed => seed.includes("track record"))).toBe(false);
});
