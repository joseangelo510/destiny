import { describe, expect, it } from "vitest";
import {
  activeWebsiteFrom,
  canonicalWebsites,
  isWebsiteId,
  shouldPersistWebsiteSelection,
  siteScopedHref,
} from "./workspace-selection";

const websites = [
  { id: "11111111-1111-4111-8111-111111111111", normalized_domain: "first.example" },
  { id: "22222222-2222-4222-8222-222222222222", normalized_domain: "second.example" },
];

describe("workspace website selection", () => {
  it("keeps one deterministic canonical row per normalized domain", () => {
    const duplicateRows = [
      { id: "33333333-3333-4333-8333-333333333333", normalized_domain: "same.example", business_name: "", products_services: "", onboarding_completed_at: null, updated_at: "2026-08-25T10:00:00Z" },
      { id: "44444444-4444-4444-8444-444444444444", normalized_domain: "same.example", business_name: "Same", products_services: "Services", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-21T10:00:00Z" },
      { id: "55555555-5555-4555-8555-555555555555", normalized_domain: "other.example", business_name: "Other", products_services: "", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-22T10:00:00Z" },
    ];
    expect(canonicalWebsites(duplicateRows).map((site) => site.id)).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]);
  });

  it("uses completeness, recency, then UUID as deterministic tie breakers", () => {
    const candidates = [
      { id: "77777777-7777-4777-8777-777777777777", normalized_domain: "tie.example", business_name: "Tie", products_services: "", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-22T10:00:00Z" },
      { id: "88888888-8888-4888-8888-888888888888", normalized_domain: "tie.example", business_name: "Tie", products_services: "Services", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-21T10:00:00Z" },
      { id: "66666666-6666-4666-8666-666666666666", normalized_domain: "tie.example", business_name: "Tie", products_services: "Services", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-21T10:00:00Z" },
    ];
    expect(canonicalWebsites(candidates)[0].id).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("honors an explicit accessible UUID even when it is not the canonical duplicate", () => {
    const duplicateRows = [
      { id: "33333333-3333-4333-8333-333333333333", normalized_domain: "same.example", business_name: "", products_services: "", onboarding_completed_at: null, updated_at: "2026-08-25T10:00:00Z" },
      { id: "44444444-4444-4444-8444-444444444444", normalized_domain: "same.example", business_name: "Same", products_services: "Services", onboarding_completed_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-21T10:00:00Z" },
    ];
    expect(activeWebsiteFrom(duplicateRows, duplicateRows[0].id)?.id).toBe(duplicateRows[0].id);
  });

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
