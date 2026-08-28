import { describe, expect, it, vi } from "vitest";
import {
  parsePublicArtifactManifest,
  verifyPublicArtifact,
} from "../support/public-artifact-verifier.mjs";

const wordpressArtifact = {
  label: "ClearCheck FCRA guide",
  websiteId: "clearcheck-site",
  kind: "wordpress",
  publicUrl: "https://clearcheck.app/2026/08/fcra-compliant-background-checks-employer-guide/",
  expectedHost: "clearcheck.app",
  expectedText: ["FCRA-Compliant Background Checks", "Employer Guide"],
  expectedCanonical: "https://clearcheck.app/2026/08/fcra-compliant-background-checks-employer-guide/",
};

describe("public artifact verifier", () => {
  it("rejects generic share intents and homepages as publication proof", () => {
    expect(() => parsePublicArtifactManifest([
      { ...wordpressArtifact, kind: "linkedin", publicUrl: "https://www.linkedin.com/sharing/share-offsite/?url=https://clearcheck.app/", expectedHost: "linkedin.com", expectedCanonical: null },
    ])).toThrow(/specific public post URL/i);
    expect(() => parsePublicArtifactManifest([
      { ...wordpressArtifact, publicUrl: "https://clearcheck.app/" },
    ])).toThrow(/specific public post URL/i);
  });

  it("accepts exact WordPress, LinkedIn, and X post URLs", () => {
    expect(parsePublicArtifactManifest([
      wordpressArtifact,
      {
        label: "LinkedIn launch post",
        websiteId: "clearcheck-site",
        kind: "linkedin",
        publicUrl: "https://www.linkedin.com/posts/example_clearcheck-launch-activity-1234567890-abcd",
        expectedHost: "linkedin.com",
        expectedText: ["ClearCheck launch"],
      },
      {
        label: "X launch post",
        websiteId: "clearcheck-site",
        kind: "x",
        publicUrl: "https://x.com/clearcheck/status/1234567890",
        expectedHost: "x.com",
        expectedText: ["ClearCheck launch"],
      },
    ])).toHaveLength(3);
  });

  it("uses an unauthenticated fetch and returns evidence only when host, content, and canonical match", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toBeUndefined();
      expect(init?.credentials).toBe("omit");
      return {
        ok: true,
        status: 200,
        url: wordpressArtifact.publicUrl,
        headers: { get: () => "text/html" },
        text: async () => `<!doctype html><html><head><link rel="canonical" href="${wordpressArtifact.expectedCanonical}"></head><body><h1>FCRA-Compliant Background Checks</h1><p>Employer Guide</p></body></html>`,
      } as Response;
    });

    const evidence = await verifyPublicArtifact(wordpressArtifact, { fetcher, checkedAt: "2026-08-28T18:00:00.000Z" });
    expect(evidence).toMatchObject({
      label: wordpressArtifact.label,
      websiteId: wordpressArtifact.websiteId,
      kind: "wordpress",
      state: "publicly_verified",
      httpStatus: 200,
      finalUrl: wordpressArtifact.publicUrl,
      checkedAt: "2026-08-28T18:00:00.000Z",
      matchedText: wordpressArtifact.expectedText,
      canonicalMatches: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the public page is missing the expected article content", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: wordpressArtifact.publicUrl,
      headers: { get: () => "text/html" },
      text: async () => "<html><body>Different article</body></html>",
    } as Response));
    await expect(verifyPublicArtifact(wordpressArtifact, { fetcher })).rejects.toThrow(/expected public content/i);
  });
});
