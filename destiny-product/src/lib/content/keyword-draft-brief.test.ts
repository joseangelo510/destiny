import { describe, expect, it } from "vitest";
import { restoreKeywordDraftBrief } from "./keyword-draft-brief";

describe("saved keyword draft instructions", () => {
  it("restores the selected page type from a saved starter brief", () => {
    const draft = { keyword: "seo agency", generationStatus: "starter", body: "", agentBrief: { angle: "Service landing page about seo agency, for SaaS teams." } };
    expect(restoreKeywordDraftBrief(draft)).toMatchObject({ preferences: { specialInstructions: draft.agentBrief.angle } });
  });
  it("preserves user preferences, generated content and unrelated drafts", () => {
    for (const draft of [
      { generationStatus: "starter", preferences: { specialInstructions: "My direction" }, agentBrief: { angle: "New angle" } },
      { generationStatus: "generated", agentBrief: { angle: "Old angle" } },
      { generationStatus: "starter", body: "A written draft", agentBrief: { angle: "Old angle" } },
      { generationStatus: "starter", body: "" },
    ]) expect(restoreKeywordDraftBrief(draft)).toBe(draft);
  });
});
