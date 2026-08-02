import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicOnboarding } from "./public-onboarding";

describe("PublicOnboarding momentum experience", () => {
  it("keeps the founder-led questions and presents them as a visible journey", () => {
    const html = renderToStaticMarkup(<PublicOnboarding />);

    expect(html).toContain("Build the momentum to be found");
    expect(html).toContain("Your path");
    expect(html).toContain("Small steps. Real evidence. No SEO team required.");
    expect(html).toContain("Tell us about your business and the products or services you provide");
    expect(html).toContain("What problem are you solving with your products or services?");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Sound on");
  });
});
