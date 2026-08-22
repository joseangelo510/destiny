import { describe, expect, it } from "vitest";
import {
  buildInterlinkInventory,
  findInterlinkOpportunities,
  interlinkStatusTransition,
  isSafePublicWebsiteUrl,
  reconcileFreshOpportunityState,
  normalizeInternalUrl,
  verifyImplementedLink,
  type InterlinkPageSnapshot,
} from "./interlinking";

const site = "https://example.com";

function page(input: Partial<InterlinkPageSnapshot> & Pick<InterlinkPageSnapshot, "url" | "title" | "text">): InterlinkPageSnapshot {
  return {
    url: input.url,
    title: input.title,
    text: input.text,
    role: input.role ?? "other",
    statusCode: input.statusCode ?? 200,
    indexable: input.indexable ?? true,
    canonicalUrl: input.canonicalUrl ?? input.url,
    links: input.links ?? [],
    targetTerms: input.targetTerms ?? [],
    bestRank: input.bestRank ?? 0,
    searchVolume: input.searchVolume ?? 0,
    published: input.published ?? false,
  };
}

describe("internal-link opportunity engine", () => {
  it("normalizes only same-site content URLs", () => {
    expect(normalizeInternalUrl("/services/seo/?utm_source=test#proof", site)).toBe("https://example.com/services/seo");
    expect(normalizeInternalUrl("https://www.example.com/services/seo/", site)).toBe("https://example.com/services/seo");
    expect(normalizeInternalUrl("https://other.example/services/seo", site)).toBeNull();
    expect(normalizeInternalUrl("mailto:hello@example.com", site)).toBeNull();
    expect(normalizeInternalUrl("/guide.pdf", site)).toBeNull();
  });

  it("blocks private and local addresses from server-side page checks", () => {
    expect(isSafePublicWebsiteUrl("https://example.com/page")).toBe(true);
    expect(isSafePublicWebsiteUrl("http://127.0.0.1/admin")).toBe(false);
    expect(isSafePublicWebsiteUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafePublicWebsiteUrl("http://192.168.1.20/page")).toBe(false);
    expect(isSafePublicWebsiteUrl("http://localhost:3000/page")).toBe(false);
  });

  it("builds a deduplicated inventory from audited, ranked, and published pages", () => {
    const inventory = buildInterlinkInventory({
      websiteUrl: site,
      auditPages: [{ url: `${site}/`, title: "Home", text: "SEO services for founders", role: "homepage" }],
      keywords: [
        { keyword: "seo services", url: `${site}/services/seo/`, rank: 8, searchVolume: 1000 },
        { keyword: "seo agency", url: `${site}/services/seo?ref=rank`, rank: 12, searchVolume: 500 },
      ],
      publishedPages: [{ url: `${site}/blog/seo-guide`, title: "SEO guide" }],
    });
    expect(inventory.map((item) => item.url)).toEqual([
      "https://example.com/",
      "https://example.com/blog/seo-guide",
      "https://example.com/services/seo",
    ]);
    expect(inventory[2]).toMatchObject({ targetTerms: ["seo services", "seo agency"], bestRank: 8, searchVolume: 1000 });
  });

  it("finds a real sentence and suppresses self-links, duplicates, and unsafe targets", () => {
    const source = page({
      url: `${site}/pricing`,
      title: "Pricing",
      text: "Our SEO services help founders build durable demand. Choose the plan that fits your team.",
    });
    const target = page({
      url: `${site}/services/seo`,
      title: "SEO services",
      text: "SEO coaching and implementation.",
      targetTerms: ["seo services"],
      bestRank: 8,
      searchVolume: 1000,
    });
    const unsafe = page({
      url: `${site}/private`,
      title: "Private page",
      text: "Private",
      targetTerms: ["private page"],
      indexable: false,
    });
    const opportunities = findInterlinkOpportunities([source, target, unsafe], site);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      sourceUrl: `${site}/pricing`,
      targetUrl: `${site}/services/seo`,
      anchorText: "SEO services",
      sourceSentence: "Our SEO services help founders build durable demand.",
      priority: "high",
    });

    expect(findInterlinkOpportunities([{ ...source, links: [{ url: target.url, anchor: "SEO services" }] }, target], site)).toEqual([]);
  });

  it("does not invent an anchor when the target phrase is absent", () => {
    const source = page({ url: `${site}/pricing`, title: "Pricing", text: "Choose the plan that fits your team." });
    const target = page({ url: `${site}/services/seo`, title: "SEO services", text: "Service page", targetTerms: ["seo services"] });
    expect(findInterlinkOpportunities([source, target], site)).toEqual([]);
  });

  it("caps suggestions per source and target and orders them deterministically", () => {
    const source = page({
      url: `${site}/guide`,
      title: "Guide",
      text: "SEO services matter. Content strategy matters. Technical SEO matters. Keyword research matters.",
    });
    const targets = [
      ["seo services", 6, 1000],
      ["content strategy", 10, 800],
      ["technical seo", 14, 600],
      ["keyword research", 20, 500],
    ].map(([term, rank, volume]) => page({
      url: `${site}/${String(term).replaceAll(" ", "-")}`,
      title: String(term),
      text: String(term),
      targetTerms: [String(term)],
      bestRank: Number(rank),
      searchVolume: Number(volume),
    }));
    const opportunities = findInterlinkOpportunities([source, ...targets], site);
    expect(opportunities).toHaveLength(3);
    expect(opportunities.map((item) => item.anchorText)).toEqual(["SEO services", "Content strategy", "Technical SEO"]);
  });

  it("verifies a claimed change only when the live HTML contains the exact target", () => {
    const html = '<p>Read our <a href="/services/seo/?ref=article">SEO services</a> guide.</p>';
    expect(verifyImplementedLink(html, `${site}/pricing`, `${site}/services/seo`)).toEqual({ found: true, anchor: "SEO services" });
    expect(verifyImplementedLink(html, `${site}/pricing`, `${site}/services/content`)).toEqual({ found: false, anchor: "" });
  });

  it("keeps claimed and verified states separate", () => {
    expect(interlinkStatusTransition("suggested", "approve")).toBe("approved");
    expect(interlinkStatusTransition("approved", "mark_done")).toBe("done_claimed");
    expect(interlinkStatusTransition("done_claimed", "mark_done")).toBeNull();
    expect(interlinkStatusTransition("verified", "skip")).toBeNull();
  });

  it("demotes old verification when a fresh scan proves the link is absent", () => {
    expect(reconcileFreshOpportunityState({ status: "verified", verifiedAt: "2026-08-20", verifiedAnchor: "SEO services" })).toEqual({
      status: "approved",
      verifiedAt: null,
      verifiedAnchor: null,
    });
    expect(reconcileFreshOpportunityState({ status: "skipped", verifiedAt: null, verifiedAnchor: null }).status).toBe("skipped");
  });
});
