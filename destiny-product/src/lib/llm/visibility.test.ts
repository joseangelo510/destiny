import { describe, expect, it } from "vitest";
import { parseLlmVisibility } from "./visibility";

describe("DataForSEO LLM visibility", () => {
  it("returns platform metrics and top cited companies with websites", () => {
    const targetMetrics = { status_code: 20000, tasks: [{ status_code: 20000, result: [{ aggregated_metrics: {
      platform: [{ key: "chat_gpt", mentions: 14, ai_search_volume: 880 }, { key: "google", mentions: 6, ai_search_volume: 420 }],
    } }] }] };
    const topDomains = { status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { key: "ivywise.com", platform: [{ key: "chat_gpt", mentions: 22, ai_search_volume: 1100 }] },
      { key: "collegevine.com", platform: [{ key: "chat_gpt", mentions: 17, ai_search_volume: 900 }] },
    ] }] }] };
    expect(parseLlmVisibility(targetMetrics, topDomains)).toEqual({
      status: "available",
      totalMentions: 20,
      aiSearchVolume: 1300,
      platforms: [
        { platform: "ChatGPT", mentions: 14, aiSearchVolume: 880 },
        { platform: "Google AI Overviews", mentions: 6, aiSearchVolume: 420 },
      ],
      topCitedDomains: [
        { company: "Ivywise", domain: "ivywise.com", website: "https://ivywise.com", mentions: 22, aiSearchVolume: 1100 },
        { company: "Collegevine", domain: "collegevine.com", website: "https://collegevine.com", mentions: 17, aiSearchVolume: 900 },
      ],
    });
  });
});
