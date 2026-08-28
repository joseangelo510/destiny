export type ReoptimizationEvidence = {
  auditId: string;
  websiteId: string;
  keyword: string;
  pageUrl: string;
  businessName: string;
  productsServices: string;
  idealCustomer: string;
  searchVolume: number;
  rank: number;
  gscPosition: number;
  gscImpressions: number;
  gscClicks: number;
};

export type ReoptimizationPageSnapshot = {
  state: "fetched" | "unverified";
  fetchedAt: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  firstParagraph: string | null;
  hasFaq: boolean;
};
