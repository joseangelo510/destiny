import { buildPublicationReceipt, type PublicationReceiptInput } from "@/lib/cms/publication-receipt";

export type CmsTransferShareCandidate = {
  articleKey?: unknown;
  publicationStatus?: unknown;
  remotePermalink?: unknown;
  verifiedLiveAt?: unknown;
  verificationEvidence?: unknown;
} & PublicationReceiptInput;

export function latestVerifiedShareTarget(
  transfers: CmsTransferShareCandidate[],
  fallbackUrl: string,
  businessName: string,
) {
  const live = transfers
    .map((transfer) => buildPublicationReceipt(transfer))
    .filter((receipt) => receipt.canShare && receipt.canonicalUrl)
    .sort((left, right) => String(right.verifiedLiveAt ?? "").localeCompare(String(left.verifiedLiveAt ?? "")))[0];
  const url = live?.canonicalUrl ?? fallbackUrl;
  const keyword = live?.articleKey.split(":").at(-1)?.replaceAll("-", " ").trim() ?? "";
  return {
    url,
    title: live ? `New from ${businessName}${keyword ? `: ${keyword}` : ""}` : `Explore ${businessName}`,
    verifiedArticle: Boolean(live),
  };
}
