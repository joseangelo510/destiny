import { expect, it } from "vitest";
import { buildArticleDraft, buildPersistedArticleDraftSeeds } from "./article-draft";
const context = { businessName: "Test", problemSolved: "", idealCustomer: "", differentiation: "" };
it("opens the explicitly selected approved fallback before three older saved drafts", () => {
  const selected = buildArticleDraft({ ...context, keyword: "selected topic" });
  const seeds = buildPersistedArticleDraftSeeds([selected], [{ keyword: "one" }, { keyword: "two" }, { keyword: "three" }], context, 3, "SELECTED TOPIC");
  expect(seeds.map(draft => draft.keyword)).toEqual(["selected topic", "one", "two"]);
});
it("does not create a topic from an unknown selection", () => {
  expect(buildPersistedArticleDraftSeeds([], [{ keyword: "saved topic" }], context, 3, "unknown").map(draft => draft.keyword)).toEqual(["saved topic"]);
});
