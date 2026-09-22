import { expect, it } from "vitest";
import { preserveEditedDrafts } from "./draft-hydration";
it("keeps edits made during loading and restores untouched server drafts", () => {
  const edited = { keyword: "interview", body: "My new words", approved: false };
  const current = [edited, { keyword: "other", body: "Starter", approved: false }];
  const loaded = [{ keyword: "interview", body: "Old words", approved: true }, { keyword: "other", body: "Saved server article", approved: true }];
  expect(preserveEditedDrafts(loaded, current, new Set(["interview"]))).toEqual([edited, loaded[1]]);
});
it("uses saved content and approval when no draft was edited", () => {
  const loaded = [{ keyword: "interview", body: "Saved", approved: true }];
  expect(preserveEditedDrafts(loaded, [{ keyword: "interview", body: "Starter", approved: false }], new Set())).toEqual(loaded);
});
