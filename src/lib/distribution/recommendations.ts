export type DirectoryRecommendation = {
  key: string;
  name: string;
  href: string;
  detail: string;
  reason?: string;
};

export type SocialChannel = { name: string; detail: string };
export type CreatorProspect = {
  name: string;
  domain: string;
  platform: string;
  title: string;
  url: string;
  keyword: string;
  audience: string;
};

export const baseDirectories: DirectoryRecommendation[] = [
  { key: "google-business-profile", name: "Google Business Profile", href: "https://business.google.com/", detail: "Manage how your business appears across Google Search and Maps." },
  { key: "yelp", name: "Yelp", href: "https://biz.yelp.com/", detail: "Claim your profile and make it easy for customers to leave honest reviews." },
  { key: "apple-maps", name: "Apple Maps", href: "https://businessconnect.apple.com/", detail: "Claim your place card through Apple Business Connect." },
  { key: "product-hunt", name: "Product Hunt", href: "https://www.producthunt.com/posts/new", detail: "Launch or update your product listing." },
  { key: "g2", name: "G2", href: "https://www.g2.com/products/new", detail: "Create a product profile and invite verified customers." },
  { key: "capterra", name: "Capterra", href: "https://www.capterra.com/vendors/sign-up", detail: "Add your software or service to the buyer directory." },
];

const directoryHosts: Record<string, string[]> = {
  "google-business-profile": ["google.com", "business.google.com", "maps.google.com", "goo.gl"],
  yelp: ["yelp.com"],
  "apple-maps": ["apple.com", "maps.apple.com", "businessconnect.apple.com"],
  "product-hunt": ["producthunt.com"],
  g2: ["g2.com"],
  capterra: ["capterra.com"],
};

export function directoryProfileMatches(directoryKey: string, value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return (directoryHosts[directoryKey] ?? []).some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
  } catch { return false; }
}

const contextualDirectories: Array<{ terms: RegExp; items: DirectoryRecommendation[] }> = [
  { terms: /agency|marketing|design|creative|consult/i, items: [
    { key: "clutch", name: "Clutch", href: "https://clutch.co/get-listed", detail: "Build a verified services profile.", reason: "Agency buyers use Clutch to compare specialist partners." },
    { key: "designrush", name: "DesignRush", href: "https://www.designrush.com/agency/submit", detail: "Submit your agency profile.", reason: "DesignRush is relevant to buyers researching marketing and design firms." },
  ] },
  { terms: /restaurant|cafe|food|bakery|bar\b|catering/i, items: [
    { key: "bing-places", name: "Bing Places", href: "https://www.bingplaces.com/", detail: "Claim your local listing.", reason: "Bing Places expands local discovery beyond Google." },
    { key: "yellow-pages", name: "Yellow Pages", href: "https://www.yellowpages.com/", detail: "Find or claim your business listing.", reason: "Yellow Pages remains a useful local citation source." },
    { key: "tripadvisor", name: "Tripadvisor", href: "https://www.tripadvisor.com/Owners", detail: "Claim the restaurant listing.", reason: "Diners use Tripadvisor to compare nearby options and reviews." },
  ] },
  { terms: /local|home service|junk|plumb|roof|clean|moving|landscap|repair/i, items: [
    { key: "bing-places", name: "Bing Places", href: "https://www.bingplaces.com/", detail: "Claim your local listing.", reason: "Bing Places expands your local search footprint." },
    { key: "yellow-pages", name: "Yellow Pages", href: "https://www.yellowpages.com/", detail: "Find or claim your business listing.", reason: "A consistent local citation helps customers verify the business." },
    { key: "nextdoor", name: "Nextdoor", href: "https://business.nextdoor.com/", detail: "Create a neighborhood business page.", reason: "Nextdoor reaches nearby customers asking for service recommendations." },
  ] },
  { terms: /software|saas|app\b|platform|technology/i, items: [
    { key: "product-hunt", name: "Product Hunt", href: "https://www.producthunt.com/posts/new", detail: "Launch or update your product listing.", reason: "Product buyers and early adopters discover new software here." },
    { key: "g2", name: "G2", href: "https://www.g2.com/products/new", detail: "Create a product profile.", reason: "G2 captures high-intent software comparison searches." },
    { key: "capterra", name: "Capterra", href: "https://www.capterra.com/vendors/sign-up", detail: "Create a vendor profile.", reason: "Capterra reaches buyers comparing software categories." },
  ] },
  { terms: /real estate|realtor|property|home buyer|home seller/i, items: [
    { key: "zillow", name: "Zillow", href: "https://www.zillow.com/professionals/real-estate-agent-reviews/", detail: "Complete your agent profile.", reason: "Home buyers use Zillow to research local agents." },
    { key: "realtor", name: "Realtor.com", href: "https://www.realtor.com/marketing/resources/", detail: "Review your professional presence.", reason: "Realtor.com supports high-intent local agent discovery." },
  ] },
];

export function recommendedDirectories(context: string): DirectoryRecommendation[] {
  const found = contextualDirectories.filter((group) => group.terms.test(context)).flatMap((group) => group.items);
  return [...new Map(found.map((item) => [item.key, item])).values()].slice(0, 5);
}

export function recommendedSocialChannels(context: string): { base: SocialChannel[]; additional: SocialChannel[] } {
  const base = [
    { name: "LinkedIn", detail: "Share expertise with professional buyers and partners." },
    { name: "X", detail: "Turn one insight into a short public conversation." },
    { name: "Facebook", detail: "Reach customers and relevant local or industry groups." },
  ];
  const additional: SocialChannel[] = [];
  if (/local|restaurant|cafe|food|junk|plumb|roof|clean|moving|real estate/i.test(context)) additional.push({ name: "Nextdoor", detail: "Reach nearby customers in neighborhood conversations." }, { name: "Instagram", detail: "Show visual proof, process, and customer outcomes." });
  if (/software|saas|app\b|technology|founder/i.test(context)) additional.push({ name: "Reddit", detail: "Contribute useful answers in topic-specific communities." }, { name: "Hacker News", detail: "Share genuinely useful technical or founder lessons." });
  if (/consult|agency|education|college|coach|professional/i.test(context)) additional.push({ name: "YouTube", detail: "Answer high-intent questions with useful demonstrations." }, { name: "Medium", detail: "Republish a focused expert perspective with a canonical link." });
  return { base, additional: [...new Map(additional.map((item) => [item.name, item])).values()].slice(0, 5) };
}

export function isPaidPlan(planTier: string | null | undefined): boolean {
  return planTier === "moderate" || planTier === "super_growth";
}

const majorMedia = /(^|\.)(forbes|nytimes|foxnews|cnn|bbc|wsj|washingtonpost|businessinsider)\.(com|co\.uk)$/i;

export function creatorProspects(rows: Array<Record<string, unknown>>): CreatorProspect[] {
  return rows.flatMap((row) => {
    const domain = String(row.domain ?? "").replace(/^www\./, "").toLowerCase();
    const url = String(row.url ?? "");
    if (!domain || !url || majorMedia.test(domain)) return [];
    const platform = domain.includes("medium.com") ? "Medium" : domain.includes("youtube.com") ? "YouTube" : domain.includes("linkedin.com") ? "LinkedIn" : domain.includes("instagram.com") ? "Instagram" : "Independent blog";
    return [{
      name: String(row.name ?? domain),
      domain,
      platform,
      title: String(row.title ?? "Relevant published work"),
      url,
      keyword: String(row.keyword ?? "your priority topic"),
      audience: "Audience size needs verification",
    }];
  });
}
