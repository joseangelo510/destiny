export type CmsTransferShareCandidate = {
  articleKey?: unknown;
  publicationStatus?: unknown;
  remotePermalink?: unknown;
  verifiedLiveAt?: unknown;
};

export function latestVerifiedShareTarget(
  transfers: CmsTransferShareCandidate[],
  fallbackUrl: string,
  businessName: string,
) {
  const live = transfers
    .filter((transfer) => transfer.publicationStatus === "published")
    .filter((transfer) => typeof transfer.remotePermalink === "string" && /^https:\/\//i.test(transfer.remotePermalink))
    .filter((transfer) => typeof transfer.verifiedLiveAt === "string" && !Number.isNaN(Date.parse(transfer.verifiedLiveAt)))
    .sort((left, right) => String(right.verifiedLiveAt ?? "").localeCompare(String(left.verifiedLiveAt ?? "")))[0];
  const url = typeof live?.remotePermalink === "string" ? live.remotePermalink : fallbackUrl;
  const keyword = typeof live?.articleKey === "string" ? live.articleKey.split(":").at(-1)?.replaceAll("-", " ").trim() : "";
  return {
    url,
    title: live ? `New from ${businessName}${keyword ? `: ${keyword}` : ""}` : `Explore ${businessName}`,
    verifiedArticle: Boolean(live),
  };
}
