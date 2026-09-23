import { buildPublicationReceipt, type PublicationReceiptInput } from "@/lib/cms/publication-receipt";

type PublishedState = { state: "verified_live" | "published_needs_review" | "published_unverified"; reason: string | null; url: string | null };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function articleKey(auditId: string, keyword: string) {
  return `${auditId.trim()}:${keyword.trim()}`;
}

export function publishedWordPressTransfer(receipts: unknown[], key: string): PublicationReceiptInput | null {
  const match = receipts.map(record).find((raw) => {
    if (text(raw.provider) !== "wordpress" || text(raw.articleKey) !== key || text(raw.remoteStatus) !== "publish") return false;
    return ["published_unverified", "verification_failed", "verified_live", "changed_in_cms", "stale"].includes(text(raw.publicationStatus));
  });
  return match ?? null;
}

export function publishedArticleState(transfer: PublicationReceiptInput): PublishedState {
  const receipt = buildPublicationReceipt(transfer);
  const reason = text(record(transfer.verificationEvidence).reason) || null;
  const url = text(transfer.remotePermalink) || null;
  if (receipt.stage === "live_verified") return { state: "verified_live", reason: null, url };
  if (receipt.recordedStatus === "verification_failed") return { state: "published_needs_review", reason, url };
  return { state: "published_unverified", reason, url };
}
