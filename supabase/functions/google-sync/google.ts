type JsonRecord = Record<string, unknown>;

export type GoogleSyncResult = {
  externalAccountId: string | null;
  metadata: JsonRecord;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function domainFromUrl(value: string) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

async function googleJson(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Google API returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function reportingDates() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export async function syncSearchConsole(accessToken: string, domain: string): Promise<GoogleSyncResult> {
  const sitesPayload = record(await googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken));
  const sites = list(sitesPayload.siteEntry).map(record);
  const selected = sites.find((site) => text(site.siteUrl) === `sc-domain:${domain}`)
    ?? sites.find((site) => domainFromUrl(text(site.siteUrl)) === domain)
    ?? sites[0];
  if (!selected) return { externalAccountId: null, metadata: { siteCount: 0, notice: "No Search Console property was available to this Google account." } };

  const siteUrl = text(selected.siteUrl);
  const dates = reportingDates();
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const [totalsPayload, queriesPayload] = await Promise.all([
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...dates, dimensions: [], rowLimit: 1, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...dates, dimensions: ["query"], rowLimit: 10, dataState: "final" }) }),
  ]);
  const totals = record(list(record(totalsPayload).rows)[0]);
  const topQueries = list(record(queriesPayload).rows).map(record).map((row) => ({
    query: text(list(row.keys)[0]), clicks: number(row.clicks), impressions: number(row.impressions), position: number(row.position),
  }));
  return {
    externalAccountId: siteUrl,
    metadata: {
      ...dates,
      selectedSiteUrl: siteUrl,
      availableSites: sites.slice(0, 25).map((site) => ({ siteUrl: text(site.siteUrl), permissionLevel: text(site.permissionLevel) })),
      clicks: number(totals.clicks), impressions: number(totals.impressions), ctr: number(totals.ctr), position: number(totals.position), topQueries,
    },
  };
}

export async function syncGoogleAnalytics(accessToken: string): Promise<GoogleSyncResult> {
  const accountsPayload = record(await googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", accessToken));
  const properties = list(accountsPayload.accountSummaries).flatMap((accountValue) => {
    const account = record(accountValue);
    return list(account.propertySummaries).map((propertyValue) => {
      const property = record(propertyValue);
      return { property: text(property.property), displayName: text(property.displayName), accountName: text(account.displayName) };
    });
  }).filter((property) => property.property);
  const selected = properties[0];
  if (!selected) return { externalAccountId: null, metadata: { propertyCount: 0, notice: "No GA4 property was available to this Google account." } };

  const report = record(await googleJson(`https://analyticsdata.googleapis.com/v1beta/${selected.property}:runReport`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "keyEvents" }],
      dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      limit: 1,
    }),
  }));
  const values = list(record(list(report.rows)[0]).metricValues).map((value) => number(record(value).value));
  return {
    externalAccountId: selected.property,
    metadata: {
      selectedProperty: selected,
      availableProperties: properties.slice(0, 50),
      dateRange: "Last 28 complete days",
      organicSessions: values[0] ?? 0,
      organicActiveUsers: values[1] ?? 0,
      organicKeyEvents: values[2] ?? 0,
    },
  };
}

export async function syncBusinessProfile(accessToken: string, domain: string): Promise<GoogleSyncResult> {
  const accountsPayload = record(await googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20", accessToken));
  const accounts = list(accountsPayload.accounts).map(record);
  for (const account of accounts) {
    const accountName = text(account.name);
    if (!accountName) continue;
    const locationsUrl = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
    locationsUrl.searchParams.set("pageSize", "100");
    locationsUrl.searchParams.set("readMask", "name,title,websiteUri,metadata");
    const locationsPayload = record(await googleJson(locationsUrl.toString(), accessToken));
    const locations = list(locationsPayload.locations).map(record);
    const selected = locations.find((location) => domainFromUrl(text(location.websiteUri)) === domain) ?? locations[0];
    if (!selected) continue;
    const locationName = text(selected.name);
    const reviews = record(await googleJson(`https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews?pageSize=10&orderBy=updateTime%20desc`, accessToken));
    return {
      externalAccountId: `${accountName}/${locationName}`,
      metadata: {
        accountName: text(account.accountName),
        selectedLocation: { name: locationName, title: text(selected.title), websiteUri: text(selected.websiteUri), metadata: record(selected.metadata) },
        availableLocations: locations.slice(0, 50).map((location) => ({ name: text(location.name), title: text(location.title), websiteUri: text(location.websiteUri) })),
        reviewCount: number(reviews.totalReviewCount), averageRating: number(reviews.averageRating),
        recentReviews: list(reviews.reviews).slice(0, 5).map((reviewValue) => {
          const review = record(reviewValue);
          return { starRating: text(review.starRating), comment: text(review.comment).slice(0, 500), updateTime: text(review.updateTime), reviewer: text(record(review.reviewer).displayName) };
        }),
      },
    };
  }
  return { externalAccountId: null, metadata: { accountCount: accounts.length, notice: "No Business Profile location was available to this Google account." } };
}

export async function syncYouTube(accessToken: string): Promise<GoogleSyncResult> {
  const channelPayload = record(await googleJson("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", accessToken));
  const channel = record(list(channelPayload.items)[0]);
  if (!text(channel.id)) return { externalAccountId: null, metadata: { notice: "No YouTube channel was available to this Google account." } };
  const dates = reportingDates();
  const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  analyticsUrl.search = new URLSearchParams({ ids: "channel==MINE", startDate: dates.startDate, endDate: dates.endDate, metrics: "views,estimatedMinutesWatched,subscribersGained" }).toString();
  const analytics = record(await googleJson(analyticsUrl.toString(), accessToken));
  const values = list(analytics.rows)[0];
  const row = Array.isArray(values) ? values : [];
  const statistics = record(channel.statistics);
  return {
    externalAccountId: text(channel.id),
    metadata: {
      ...dates,
      channelId: text(channel.id), channelTitle: text(record(channel.snippet).title),
      subscribers: number(statistics.subscriberCount), lifetimeViews: number(statistics.viewCount), videoCount: number(statistics.videoCount),
      periodViews: number(row[0]), estimatedMinutesWatched: number(row[1]), subscribersGained: number(row[2]),
    },
  };
}
