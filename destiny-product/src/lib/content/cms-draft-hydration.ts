import type { CmsDraftResult, CmsTransferState } from "@/components/article-review-workspace";

/** Rebuild the per-article delivery state (Update vs Send, readiness checklist) from persisted transfers after a reload. */
export function hydrateCmsDrafts(transfers: CmsTransferState[], auditId: string) {
  const drafts: Record<string, CmsDraftResult> = {};
  for (const transfer of transfers) {
    if (transfer.status !== "succeeded" || !transfer.remoteEditUrl) continue;
    const prefix = `${auditId}:`;
    if (!transfer.articleKey.startsWith(prefix)) continue;
    const keyword = transfer.articleKey.slice(prefix.length);
    const key = `${transfer.provider}:${keyword}`;
    if (drafts[key]) continue;
    drafts[key] = {
      url: transfer.remoteEditUrl,
      updated: true,
      fieldReport: transfer.fieldReport ?? undefined,
      publicationStatus: transfer.publicationStatus ?? "delivered_draft",
      remotePermalink: transfer.remotePermalink,
      lastReconciledAt: transfer.lastReconciledAt,
      verifiedLiveAt: transfer.verifiedLiveAt,
      verificationEvidence: transfer.verificationEvidence,
      seoTitleRendered: transfer.seoTitleRendered,
    };
  }
  return drafts;
}

