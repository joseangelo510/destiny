import type { SeoAuditRequest, SeoAuditResult, SeoIssue, SeoProvider } from "./types";
import { normalizeWebsite } from "./url";

function stableNumber(value: string) {
  return [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

const realEstateTopics = [
  "san francisco homes for sale", "best san francisco neighborhoods for families", "first-time home buyer san francisco", "how to buy a home in san francisco",
  "san francisco home selling guide", "moving to san francisco with a family", "noe valley homes for families", "bernal heights homes for sale",
  "inner sunset homes for sale", "glen park homes for families", "san francisco school district home search", "how much house can i afford in san francisco",
  "san francisco home inspection checklist", "make a competitive home offer san francisco", "best time to sell a home in san francisco", "prepare a san francisco home for sale",
  "san francisco real estate market update", "closing costs for san francisco home buyers", "sell and buy a home at the same time", "relocating to san francisco neighborhoods",
  "family-friendly parks near san francisco homes", "walkable san francisco neighborhoods", "questions to ask a san francisco realtor", "choose a san francisco real estate agent",
];

const professionalTopics = [
  "services near me", "best local professional", "local service pricing guide", "how to choose a local provider",
  "questions to ask before hiring", "local provider reviews", "service comparison guide", "what to expect from a consultation",
  "common service mistakes to avoid", "local customer success story", "professional service checklist", "service options explained",
  "how long professional services take", "prepare for your first appointment", "local industry trends", "service costs and value",
  "when to hire a professional", "do it yourself versus hiring an expert", "local service frequently asked questions", "best solutions for growing businesses",
  "expert advice for first-time customers", "how to evaluate service quality", "local professional case study", "complete local services guide",
];

function demoKeywords(input: SeoAuditRequest, domain: string, url: string, seed: number) {
  const context = `${input.businessContext?.productsServices ?? ""} ${input.businessContext?.idealCustomer ?? ""}`.toLowerCase();
  const isRealEstate = /real estate|realtor|buy and sell homes|home buyer|home selling|property/.test(context);
  const topics = isRealEstate ? realEstateTopics : professionalTopics.map((topic, index) => index === 0 ? `${domain} services` : topic);
  return topics.map((keyword, index) => ({
    keyword,
    rank: index % 3 === 0 ? 11 + ((seed + index) % 35) : 0,
    searchVolume: 40 + ((seed + (index * 137)) % 950),
    url: index % 3 === 0 ? url : "",
    intent: /how|guide|questions|checklist|mistakes|update|versus|explained|expect|trends/.test(keyword) ? "informational" : "commercial",
    difficulty: 18 + ((seed + (index * 17)) % 55),
    cpc: 0.75 + (((seed + (index * 29)) % 650) / 100),
    opportunity: (index % 3 === 0 ? "existing_rank" : index % 3 === 1 ? "competitor_gap" : "site_idea") as "existing_rank" | "competitor_gap" | "site_idea",
  }));
}

export class DemoSeoProvider implements SeoProvider {
  async runAudit(input: SeoAuditRequest): Promise<SeoAuditResult> {
    const website = normalizeWebsite(input.website);
    const seed = stableNumber(website.domain);
    const isSeededDemo = website.domain === "example.com";

    const criticalIssues = isSeededDemo ? 3 : 1 + (seed % 5);
    const rankingKeywords = isSeededDemo ? 7 : 4 + (seed % 38);
    const contentGaps = isSeededDemo ? 8 : 5 + (seed % 21);
    const reviewCount = isSeededDemo ? 6 : seed % 19;
    const issues: SeoIssue[] = [
      { code: "missing_title", label: "Missing or weak page titles", severity: "critical" },
      { code: "broken_links", label: "Broken internal links", severity: "critical" },
      { code: "thin_content", label: "Pages with thin content", severity: "warning" },
    ];

    return {
      source: "demo",
      sourceLabel: "Demo audit data",
      domain: website.domain,
      fetchedAt: new Date().toISOString(),
      metrics: {
        criticalIssues,
        warnings: 4 + (seed % 8),
        rankingKeywords,
        newKeywords: seed % 6,
        lostKeywords: seed % 3,
        estimatedOrganicTraffic: 40 + (seed % 900),
        contentGaps,
        reviewCount,
        onPageScore: 62 + (seed % 28),
      },
      issues: issues.slice(0, Math.min(3, criticalIssues + 1)),
      competitors: [
        { domain: "local-search-competitor.example", sharedKeywords: 12 + (seed % 30) },
        { domain: "neighborhood-expert.example", sharedKeywords: 8 + (seed % 18) },
      ],
      keywords: demoKeywords(input, website.domain, website.url, seed),
      notices: [
        "This is deterministic demonstration data, not a live SEO measurement.",
        "Choose the DataForSEO provider and add API credentials to run paid live checks.",
      ],
    };
  }
}
