import { describe, expect, it } from "vitest";
import { parseDistributionSerp } from "./opportunities";

describe("live distribution opportunities", () => {
  it("keeps real contribution pages and removes search or community home pages", () => {
    const payload = {
      status_code: 20000,
      tasks: [{ status_code: 20000, result: [{ items: [
        { type: "organic", domain: "www.reddit.com", title: "How do I choose a college counselor?", url: "https://www.reddit.com/r/ApplyingToCollege/comments/abc123/how_do_i_choose/", description: "Parents discuss choosing a counselor." },
        { type: "organic", domain: "www.reddit.com", title: "Reddit search", url: "https://www.reddit.com/search/?q=college+counselor" },
        { type: "organic", domain: "www.quora.com", title: "What does a college counselor do?", url: "https://www.quora.com/What-does-a-college-counselor-do", description: "A live question." },
      ] }] }],
    };
    expect(parseDistributionSerp(payload, "college counselor").map((item) => item.url)).toEqual([
      "https://www.reddit.com/r/ApplyingToCollege/comments/abc123/how_do_i_choose/",
      "https://www.quora.com/What-does-a-college-counselor-do",
    ]);
  });
});
