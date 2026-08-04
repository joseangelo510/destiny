import { describe, expect, it } from "vitest";
import { DemoSeoProvider } from "./demo-provider";

describe("DemoSeoProvider", () => {
  it("returns stable, explicitly labeled demonstration data", async () => {
    const provider = new DemoSeoProvider();
    const first = await provider.runAudit({ website: "https://example.com" });
    const second = await provider.runAudit({ website: "example.com" });

    expect(first.source).toBe("demo");
    expect(first.sourceLabel).toBe("Demo audit data");
    expect(first.domain).toBe("example.com");
    expect(first.metrics).toEqual(second.metrics);
    expect(first.keywords).toHaveLength(24);
    expect(first.notices.join(" ")).toMatch(/demonstration data/i);
  });

  it("creates a full home-focused calendar for the realtor onboarding demo", async () => {
    const result = await new DemoSeoProvider().runAudit({
      website: "example.com",
      businessContext: { productsServices: "I help families buy and sell homes as a San Francisco realtor." },
    });
    expect(result.keywords).toHaveLength(24);
    expect(result.keywords.map((item) => item.keyword)).toContain("san francisco homes for sale");
    expect(new Set(result.keywords.map((item) => item.opportunity))).toEqual(new Set(["existing_rank", "competitor_gap", "site_idea"]));
  });
});
