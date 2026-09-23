import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CreatorProspect } from "@/lib/distribution/recommendations";
vi.mock("@/components/copy-button", () => ({ CopyButton: () => <button>Copy draft</button> }));
import { CreatorDiscovery } from "./creator-discovery";

describe("creator evidence presentation", () => {
  it("keeps reviewable publishers and vendors separate from outreach leads", () => {
    const sources: CreatorProspect[] = [
      { name: "@hrwriter", domain: "medium.com", platform: "Medium", title: "Hiring checks explained", url: "https://medium.com/@hrwriter/hiring-checks-explained-123", keyword: "background checks", audience: "Audience size needs verification", sourceKind: "candidate" },
      { name: "localhrwriter.example", domain: "localhrwriter.example", platform: "Unverified publisher", title: "A practical hiring guide", url: "https://localhrwriter.example/hiring-guide", keyword: "background checks", audience: "Audience size needs verification", sourceKind: "unverified" },
      { name: "paychex.com", domain: "paychex.com", platform: "Vendor or directory", title: "Screening services", url: "https://paychex.com/hiring/employment-screening", keyword: "background checks", audience: "Audience size needs verification", sourceKind: "commercial" },
    ];
    const html = renderToStaticMarkup(<CreatorDiscovery initialCreators={sources} paid topics={["background checks", "employment verification"]} websiteId="site-one" />);
    expect(html).toContain("Potential creator sources");
    expect(html).toContain("Other sources to review");
    expect(html).toContain("First priority keyword: background checks");
    expect(html).toContain("paychex.com");
    expect((html.match(/Copy draft/g) ?? [])).toHaveLength(1);
  });
});
