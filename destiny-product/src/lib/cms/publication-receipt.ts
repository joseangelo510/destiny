import { publicationCopy, type CmsPublicationState } from "./publication-state";

export type PublicationReceiptInput = {
  provider?: unknown;
  articleKey?: unknown;
  publicationStatus?: unknown;
  remoteEditUrl?: unknown;
  remotePermalink?: unknown;
  remoteStatus?: unknown;
  lastReconciledAt?: unknown;
  verifiedLiveAt?: unknown;
  verificationEvidence?: unknown;
};

export type PublicationReceiptStage =
  | "delivering"
  | "draft_delivered"
  | "scheduled"
  | "published_unverified"
  | "live_verified"
  | "attention";

export type PublicationReceipt = {
  provider: string;
  articleKey: string;
  recordedStatus: CmsPublicationState;
  stage: PublicationReceiptStage;
  label: string;
  detail: string;
  canonicalUrl: string | null;
  editUrl: string | null;
  canShare: boolean;
  verifiedLiveAt: string | null;
  evidenceComplete: boolean;
};

const PUBLICATION_STATES = new Set<CmsPublicationState>([
  "delivering",
  "delivered_draft",
  "scheduled",
  "published_unverified",
  "verified_live",
  "changed_in_cms",
  "stale",
  "unpublished",
  "delivery_failed",
  "verification_failed",
  "delivered_incomplete",
]);

function publicationState(value: unknown): CmsPublicationState {
  return typeof value === "string" && PUBLICATION_STATES.has(value as CmsPublicationState)
    ? value as CmsPublicationState
    : "verification_failed";
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function completePublicEvidence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const evidence = value as Record<string, unknown>;
  const status = Number(evidence.httpStatus);
  return evidence.verified === true
    && Number.isFinite(status)
    && status >= 200
    && status < 300
    && evidence.canonicalMatches === true
    && evidence.contentMatches === true
    && evidence.indexable === true;
}

function receiptStage(state: CmsPublicationState, evidenceComplete: boolean): PublicationReceiptStage {
  if (state === "delivering") return "delivering";
  if (state === "delivered_draft") return "draft_delivered";
  if (state === "scheduled") return "scheduled";
  if (state === "published_unverified") return "published_unverified";
  if (state === "verified_live") return evidenceComplete ? "live_verified" : "published_unverified";
  return "attention";
}

export function buildPublicationReceipt(input: PublicationReceiptInput): PublicationReceipt {
  const recordedStatus = publicationState(input.publicationStatus);
  const publicUrl = httpsUrl(input.remotePermalink);
  const verifiedLiveAt = validTimestamp(input.verifiedLiveAt);
  const evidenceComplete = recordedStatus === "verified_live"
    && Boolean(publicUrl)
    && Boolean(verifiedLiveAt)
    && completePublicEvidence(input.verificationEvidence);
  const stage = receiptStage(recordedStatus, evidenceComplete);
  const effectiveState: CmsPublicationState = recordedStatus === "verified_live" && !evidenceComplete
    ? "published_unverified"
    : recordedStatus;
  const copy = publicationCopy(effectiveState);

  return {
    provider: typeof input.provider === "string" ? input.provider : "",
    articleKey: typeof input.articleKey === "string" ? input.articleKey : "",
    recordedStatus,
    stage,
    label: copy.label,
    detail: copy.detail,
    canonicalUrl: evidenceComplete ? publicUrl : null,
    editUrl: httpsUrl(input.remoteEditUrl),
    canShare: evidenceComplete,
    verifiedLiveAt: evidenceComplete ? verifiedLiveAt : null,
    evidenceComplete,
  };
}
