import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PublicOnboarding } from "./public-onboarding";
import { runDestinyServerLogic } from "../lib/logicaffeine-server";

describe("PublicOnboarding momentum experience", () => {
  it("keeps the founder-led questions and presents them as a visible journey", async () => {
    const initialMomentumPolicy = await runDestinyServerLogic({ auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0, newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0, momentumOnboardingStep: 1 });
    const html = renderToStaticMarkup(<PublicOnboarding initialMomentumPolicy={initialMomentumPolicy} />);
    const source = readFileSync(new URL("./public-onboarding.tsx", import.meta.url), "utf8");

    expect(html).toContain("Build the momentum to be found");
    expect(html).toContain("Your path");
    expect(html).toContain("Small steps. Real evidence. No SEO team required.");
    expect(html).toContain("Business website URL");
    expect(html).toContain("do not enter only your business name");
    expect(html).toContain("First name");
    expect(html).toContain("Last name");
    expect(html).toContain("Contact email");
    expect(html).toContain("notification center");
    expect(html).toContain("Step 1 of 3");
    expect(source).toContain("Tell us about your business and the products or services you provide");
    expect(source).toContain("What problem are you solving with your products or services?");
    expect(source).not.toContain("Step {step} of 4");
    expect(source).not.toContain("Ready to build your search baseline?");
    expect(source).toContain("Destiny uses the United States search database automatically");
    expect(source).not.toContain("Local market");
    expect(source).not.toContain("Search database country");
    expect(source).not.toContain("San Francisco, California");
    expect(source).not.toContain("<select");
    expect(source).toContain('aria-label={`${active ? "Stop" : "Start"} dictation for ${label}`}');
    expect(source).toContain('aria-pressed={active}');
    expect(source).toContain('active ? "Listening · tap to stop" : "Dictate"');
    expect(source).toContain("Destiny will finish after 5 seconds of silence");
    expect(source).toContain('className="voice-microphone-icon"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Sound on");
    expect(html).not.toContain("destiny-compass");
  });
});
