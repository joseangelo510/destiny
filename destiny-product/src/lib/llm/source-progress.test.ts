import { describe, expect, it } from "vitest";
import {
  AI_ENGINE_CITATION_SNAPSHOTS,
  LLM_SOURCE_PLAYBOOKS,
  buildLlmSourceProgress,
  citationDomainPlaybookKey,
  parseLlmTaskUpdate,
  proofUrlMatchesWebsite,
} from "./source-progress";

describe("LLM source progress", () => {
  it("uses current, model-specific citation benchmarks instead of one universal ranking", async () => {
    expect(AI_ENGINE_CITATION_SNAPSHOTS).toHaveLength(5);
    expect(AI_ENGINE_CITATION_SNAPSHOTS.every((snapshot) => snapshot.updated === "July 2026")).toBe(true);
    expect(AI_ENGINE_CITATION_SNAPSHOTS.find((snapshot) => snapshot.id === "gemini")?.dataAsOf).toBe("June 2026");
    expect(AI_ENGINE_CITATION_SNAPSHOTS.find((snapshot) => snapshot.id === "chatgpt")?.domains[0]).toMatchObject({ domain: "reddit.com", share: 16.7 });
    expect(AI_ENGINE_CITATION_SNAPSHOTS.find((snapshot) => snapshot.id === "perplexity")?.domains[0]).toMatchObject({ domain: "youtube.com", share: 31.2 });
    expect(AI_ENGINE_CITATION_SNAPSHOTS.find((snapshot) => snapshot.id === "google-ai-overviews")?.domains[0]).toMatchObject({ domain: "youtube.com", share: 21.1 });
  });

  it("connects actionable benchmark sources to the right source playbook", async () => {
    expect(citationDomainPlaybookKey("reddit.com")).toBe("reddit");
    expect(citationDomainPlaybookKey("en.wikipedia.org")).toBe("wikipedia");
    expect(citationDomainPlaybookKey("youtube.com")).toBe("youtube");
    expect(citationDomainPlaybookKey("forbes.com")).toBe("earned-media");
    expect(citationDomainPlaybookKey("google.com")).toBeNull();
  });

  it("provides small, actionable playbooks for the source ecosystems users can influence", async () => {
    expect(LLM_SOURCE_PLAYBOOKS.map((source) => source.key)).toEqual([
      "owned-site",
      "reddit",
      "youtube",
      "linkedin",
      "quora",
      "reviews",
      "earned-media",
      "wikipedia",
      "medium",
    ]);
    expect(LLM_SOURCE_PLAYBOOKS.find((source) => source.key === "reddit")?.tasks.map((task) => task.title)).toEqual([
      "Claim your Reddit username",
      "Join 3 subreddits in your niche",
      "Answer one question with genuine help",
      "Share one lesson from your business",
    ]);
    expect(LLM_SOURCE_PLAYBOOKS.filter((source) => source.key !== "reddit").every((source) => source.tasks.length === 3)).toBe(true);

    const youtube = LLM_SOURCE_PLAYBOOKS.find((source) => source.key === "youtube");
    expect(youtube?.tasks.map((task) => task.title).join(" ")).toMatch(/buyer question/i);
    expect(youtube?.tasks.map((task) => task.description).join(" ")).toMatch(/captions|transcript/i);
    expect(youtube?.tasks.map((task) => task.description).join(" ")).toMatch(/embed/i);

    const wikipedia = LLM_SOURCE_PLAYBOOKS.find((source) => source.key === "wikipedia");
    const wikipediaCopy = wikipedia?.tasks.map((task) => `${task.title} ${task.description}`).join(" ") ?? "";
    expect(wikipediaCopy).toMatch(/independent.*coverage/i);
    expect(wikipediaCopy).toMatch(/conflict of interest|COI/i);
    expect(wikipediaCopy).toMatch(/Articles for Creation|requested edit/i);
    expect(wikipediaCopy).not.toMatch(/create a promotional|guarantee.*wikipedia/i);

    const proofTasks = LLM_SOURCE_PLAYBOOKS.flatMap((source) => source.tasks.filter((task) => task.requiresProof).map((task) => `${source.key}:${task.key}`));
    expect(proofTasks).toEqual(["earned-media:earn-mention", "medium:publish-and-connect"]);
  });

  it("computes readiness from persisted source tasks and keeps provider evidence separate", async () => {
    const result = await buildLlmSourceProgress({
      records: [
        { source_key: "youtube", task_key: "choose-question", status: "complete", completed_at: "2026-08-02T12:00:00.000Z" },
        { source_key: "youtube", task_key: "publish-video", status: "complete", completed_at: "2026-08-02T12:05:00.000Z" },
        { source_key: "reddit", task_key: "claim-username", status: "complete", completed_at: "2026-08-02T12:10:00.000Z" },
      ],
      llmVisibility: { status: "available", totalMentions: 0, platforms: [] },
    });

    expect(result.readiness).toMatchObject({ completed: 3, total: 28, percent: 11 });
    expect(result.sources.find((source) => source.key === "youtube")).toMatchObject({ completed: 2, total: 3, state: "in_progress" });
    expect(result.sources.find((source) => source.key === "reddit")).toMatchObject({ completed: 1, total: 4, percent: 25, state: "in_progress" });
    expect(result.verifiedVisibility).toMatchObject({ detected: false, evidenceAvailable: true, totalMentions: 0 });
    expect(result.publicProof).toMatchObject({ attached: 0, possible: 2, percent: 0 });
    expect(result.readiness.label).toMatch(/readiness/i);
    expect(result.readiness.label).not.toMatch(/AI visibility score|AI-visible/i);
  });

  it("does not let checklist completion fabricate a verified AI citation outcome", async () => {
    const records = LLM_SOURCE_PLAYBOOKS.flatMap((source) => source.tasks.map((task) => ({
      source_key: source.key,
      task_key: task.key,
      status: "complete",
      completed_at: "2026-08-02T12:00:00.000Z",
    })));
    const result = await buildLlmSourceProgress({ records, llmVisibility: { status: "available", totalMentions: 0, platforms: [] } });

    expect(result.readiness).toMatchObject({ completed: 28, total: 28, percent: 100 });
    expect(result.verifiedVisibility.detected).toBe(false);
    expect(result.verifiedVisibility.label).toMatch(/no provider-detected mentions/i);
  });

  it("validates source task updates against the product playbooks", async () => {
    expect(parseLlmTaskUpdate({ websiteId: "11111111-1111-4111-8111-111111111111", sourceKey: "youtube", taskKey: "publish-video", status: "complete", proofUrl: "https://www.youtube.com/watch?v=proof123" })).toEqual({
      ok: true,
      value: {
        websiteId: "11111111-1111-4111-8111-111111111111",
        sourceKey: "youtube",
        taskKey: "publish-video",
        status: "complete",
        proofUrl: null,
      },
    });
    expect(parseLlmTaskUpdate({ websiteId: "11111111-1111-4111-8111-111111111111", sourceKey: "youtube", taskKey: "publish-video", status: "complete" })).toMatchObject({ ok: true, value: { proofUrl: null } });
    expect(parseLlmTaskUpdate({ websiteId: "11111111-1111-4111-8111-111111111111", sourceKey: "youtube", taskKey: "publish-video", status: "todo", proofUrl: "https://www.youtube.com/watch?v=proof123" })).toMatchObject({ ok: true, value: { proofUrl: null } });
    expect(parseLlmTaskUpdate({ websiteId: "not-a-uuid", sourceKey: "youtube", taskKey: "publish-video", status: "complete" })).toMatchObject({ ok: false });
    expect(parseLlmTaskUpdate({ websiteId: "11111111-1111-4111-8111-111111111111", sourceKey: "wikipedia", taskKey: "publish-promotional-page", status: "complete" })).toMatchObject({ ok: false });
    expect(parseLlmTaskUpdate({ websiteId: "11111111-1111-4111-8111-111111111111", sourceKey: "youtube", taskKey: "publish-video", status: "verified" })).toMatchObject({ ok: false });
  });

  it("keeps hidden proof tracking separate from the seven-row playboard", async () => {
    const result = await buildLlmSourceProgress({
      records: [
        { source_key: "earned-media", task_key: "earn-mention", status: "complete", completed_at: "2026-08-02T12:00:00.000Z", proof_url: "https://publisher.example/story", proof_attached_at: "2026-08-02T12:01:00.000Z" },
      ],
      llmVisibility: { status: "available", totalMentions: 0, platforms: [] },
    });

    expect(result.publicProof).toMatchObject({ attached: 1, possible: 2, percent: 50 });
    expect(result.sources.find((source) => source.key === "earned-media")).toMatchObject({ proofAttached: 1, proofPossible: 1 });
    expect(result.verifiedVisibility.detected).toBe(false);
  });

  it("requires owned-site proof to belong to the onboarded website", async () => {
    expect(proofUrlMatchesWebsite("https://blog.example.com/buyer-guide", "example.com")).toBe(true);
    expect(proofUrlMatchesWebsite("https://www.example.com/buyer-guide", "www.example.com")).toBe(true);
    expect(proofUrlMatchesWebsite("https://example.com.evil.test/buyer-guide", "example.com")).toBe(false);
    expect(proofUrlMatchesWebsite("not-a-url", "example.com")).toBe(false);
  });
});
