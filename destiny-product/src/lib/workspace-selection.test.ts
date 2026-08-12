import { describe, expect, it } from "vitest";
import {
  activeWebsiteFrom,
  isWebsiteId,
  shouldPersistWebsiteSelection,
  siteScopedHref,
} from "./workspace-selection";

const websites = [
  { id: "11111111-1111-4111-8111-111111111111", normalized_domain: "first.example" },
  { id: "22222222-2222-4222-8222-222222222222", normalized_domain: "second.example" },
];

describe("workspace website selection", () => {
  it("selects a requested website only when it belongs to the accessible set", () => {
    expect(activeWebsiteFrom(websites, websites[1].id)?.normalized_domain).toBe("second.example");
    expect(activeWebsiteFrom(websites, "33333333-3333-4333-8333-333333333333")?.normalized_domain).toBe("first.example");
  });

  it("falls back safely when there are no websites", () => {
    expect(activeWebsiteFrom([], websites[0].id)).toBeNull();
  });

  it("recognizes UUID website identifiers", () => {
    expect(isWebsiteId(websites[0].id)).toBe(true);
    expect(isWebsiteId("not-a-site-id")).toBe(false);
  });

  it("adds the selected website to internal navigation while preserving query and hash", () => {
    expect(siteScopedHref("/keywords", websites[0].id)).toBe(`/keywords?site=${websites[0].id}`);
    expect(siteScopedHref("/onboarding?new=1#start", websites[1].id)).toBe(`/onboarding?new=1&site=${websites[1].id}#start`);
  });

  it("never lets a background prefetch persist a different active website", () => {
    expect(shouldPersistWebsiteSelection(new Headers())).toBe(true);
    expect(shouldPersistWebsiteSelection(new Headers({ "next-router-prefetch": "1" }))).toBe(false);
    expect(shouldPersistWebsiteSelection(new Headers({ purpose: "prefetch" }))).toBe(false);
  });
});
