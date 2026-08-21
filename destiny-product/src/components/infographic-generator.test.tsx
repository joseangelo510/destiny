import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { InfographicGenerator } from "./infographic-generator";

describe("InfographicGenerator", () => {
  it("starts with a simple topic choice and explains the four deliverables", () => {
    const html = renderToStaticMarkup(<InfographicGenerator
      generationAvailable
      websiteId="11111111-1111-4111-8111-111111111111"
      websiteName="ClearCheck"
      approvedKeywords={[
        { keyword: "employee background check trends", searchVolume: 720 },
        { keyword: "background screening statistics", searchVolume: 390 },
      ]}
    />);

    expect(html).toContain("Choose a keyword or enter your own topic");
    expect(html).toContain("employee background check trends");
    expect(html).toContain("Research current sources");
    expect(html).toContain("One long infographic");
    expect(html).toContain("Four reusable posts");
    expect(html).toContain("500–1,000-word article");
    expect(html).toContain("Google Docs-ready download");
    expect(html).not.toContain("Generate infographic");
  });

  it("shows a truthful configuration state when the image API is unavailable", () => {
    const html = renderToStaticMarkup(<InfographicGenerator
      generationAvailable={false}
      websiteId="11111111-1111-4111-8111-111111111111"
      websiteName="ClearCheck"
      approvedKeywords={[]}
    />);
    expect(html).toContain("OpenAI image generation is not connected yet");
    expect(html).toContain("disabled");
  });
});
