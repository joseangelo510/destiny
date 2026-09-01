export type ContentEvidenceInput = {
  publicationStatus?: string | null;
  publicUrl?: string | null;
  source: "cms" | "crawl" | "gsc" | "user";
  verified: boolean;
};

export type ContentEvidenceState = "published_unverified" | "verified_live";

export function derivePublishedState(input: ContentEvidenceInput): ContentEvidenceState {
  const machineSource = input.source === "cms" || input.source === "crawl" || input.source === "gsc";
  const hasPublicEvidence = Boolean(input.publicUrl?.trim());
  const explicitLiveState = input.publicationStatus === "verified_live";
  return machineSource && input.verified && hasPublicEvidence && explicitLiveState
    ? "verified_live"
    : "published_unverified";
}
