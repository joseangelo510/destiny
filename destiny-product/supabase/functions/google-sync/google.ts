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

function normalizedDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("sc-domain:")) return trimmed.slice("sc-domain:".length).replace(/^www\./, "").replace(/\.$/, "");
  return domainFromUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
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

function reportingDates(days = 28, previous = false) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 3 - (previous ? days : 0));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function dateBetween(value: string, dates: { startDate: string; endDate: string }) {
  return value >= dates.startDate && value <= dates.endDate;
}

function searchTotals(payload: unknown) {
  const row = record(list(record(payload).rows)[0]);
  return { clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) };
}

function searchDaily(payload: unknown) {
  return list(record(payload).rows).map(record).flatMap((row) => {
    const date = text(list(row.keys)[0]);
    return date ? [{ date, clicks: number(row.clicks), impressions: number(row.impressions), ctr: number(row.ctr), position: number(row.position) }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

export async function syncSearchConsole(accessToken: string, domain: string, requestedSiteUrl?: string | null): Promise<GoogleSyncResult> {
  const requestedDomain = normalizedDomain(domain);
  if (!requestedDomain) throw new Error("Destiny could not verify the website domain for Search Console.");
  const sitesPayload = record(await googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken));
  const sites = list(sitesPayload.siteEntry).map(record);
  const availableSites = sites.slice(0, 25).map((site) => {
    const siteUrl = text(site.siteUrl);
    return {
      siteUrl,
      permissionLevel: text(site.permissionLevel),
      matchesWebsite: normalizedDomain(siteUrl) === requestedDomain,
    };
  });
  const matches = availableSites.filter((site) => site.matchesWebsite);
  if (!matches.length) throw new Error(`No Search Console property matches ${requestedDomain}. Connect a Google account that can access this website.`);
  if (!requestedSiteUrl && matches.length > 1) {
    return {
      externalAccountId: null,
      metadata: { selectionRequired: true, requestedDomain, siteCount: sites.length, availableSites },
    };
  }
  const selectedSite = requestedSiteUrl
    ? availableSites.find((site) => site.siteUrl === requestedSiteUrl)
    : matches[0];
  if (!selectedSite?.matchesWebsite) throw new Error(`The selected Search Console property does not match ${requestedDomain}.`);

  const siteUrl = selectedSite.siteUrl;
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const current30 = reportingDates(30);
  const previous30 = reportingDates(30, true);
  const current90 = reportingDates(90);
  const previous90 = reportingDates(90, true);
  const [totals30Payload, previous30Payload, totals90Payload, previous90Payload, dailyPayload, queriesPayload] = await Promise.all([
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...current30, dimensions: [], rowLimit: 1, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...previous30, dimensions: [], rowLimit: 1, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...current90, dimensions: [], rowLimit: 1, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...previous90, dimensions: [], rowLimit: 1, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ startDate: previous90.startDate, endDate: current90.endDate, dimensions: ["date"], rowLimit: 25_000, dataState: "final" }) }),
    googleJson(endpoint, accessToken, { method: "POST", body: JSON.stringify({ ...current90, dimensions: ["query"], rowLimit: 10, dataState: "final" }) }),
  ]);
  const totals30 = searchTotals(totals30Payload);
  const prior30 = searchTotals(previous30Payload);
  const totals90 = searchTotals(totals90Payload);
  const prior90 = searchTotals(previous90Payload);
  const daily = searchDaily(dailyPayload);
  const topQueries = list(record(queriesPayload).rows).map(record).map((row) => ({
    query: text(list(row.keys)[0]), clicks: number(row.clicks), impressions: number(row.impressions), position: number(row.position),
  }));
  const period = (dates: { startDate: string; endDate: string }, previousDates: { startDate: string; endDate: string }, totals: ReturnType<typeof searchTotals>, previous: ReturnType<typeof searchTotals>) => ({
    ...dates,
    ...totals,
    previousClicks: previous.clicks,
    previousImpressions: previous.impressions,
    previousCtr: previous.ctr,
    previousPosition: previous.position,
    daily: daily.filter((row) => dateBetween(row.date, dates)),
    previousDaily: daily.filter((row) => dateBetween(row.date, previousDates)),
  });
  return {
    externalAccountId: siteUrl,
    metadata: {
      ...current30,
      selectedSiteUrl: siteUrl,
      requestedDomain,
      availableSites,
      clicks: totals30.clicks, impressions: totals30.impressions, ctr: totals30.ctr, position: totals30.position, topQueries,
      periods: {
        "30": period(current30, previous30, totals30, prior30),
        "90": period(current90, previous90, totals90, prior90),
      },
    },
  };
}

function analyticsTotals(payload: unknown) {
  const values = list(record(list(record(payload).rows)[0]).metricValues).map((value) => number(record(value).value));
  return {
    organicSessions: values[0] ?? 0,
    organicActiveUsers: values[1] ?? 0,
    organicEngagedSessions: values[2] ?? 0,
    organicKeyEvents: values[3] ?? 0,
  };
}

function analyticsDate(value: string) {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

function analyticsDaily(payload: unknown) {
  return list(record(payload).rows).map(record).flatMap((row) => {
    const date = analyticsDate(text(record(list(row.dimensionValues)[0]).value));
    const totals = analyticsTotals({ rows: [row] });
    return date ? [{ date, ...totals }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function analyticsTrafficSources(payload: unknown) {
  return list(record(payload).rows).map(record).flatMap((row) => {
    const dimensions = list(row.dimensionValues).map((value) => text(record(value).value));
    const sessions = number(record(list(row.metricValues)[0]).value);
    return sessions > 0 ? [{ source: dimensions[0] || "(not set)", medium: dimensions[1] || "(not set)", sessions }] : [];
  });
}

export async function syncGoogleAnalytics(accessToken: string, domain?: string, requestedProperty?: string | null): Promise<GoogleSyncResult> {
  const requestedDomain = normalizedDomain(domain ?? "");
  if (!requestedDomain) throw new Error("Destiny could not verify the website domain for Google Analytics.");
  const accountsPayload = record(await googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", accessToken));
  const properties = list(accountsPayload.accountSummaries).flatMap((accountValue) => {
    const account = record(accountValue);
    return list(account.propertySummaries).map((propertyValue) => {
      const property = record(propertyValue);
      return { property: text(property.property), displayName: text(property.displayName), accountName: text(account.displayName) };
    });
  }).filter((property) => property.property);
  if (!properties.length) return { externalAccountId: null, metadata: { propertyCount: 0, notice: "No GA4 property was available to this Google account." } };
  const propertiesWithStreams = await Promise.all(properties.slice(0, 50).map(async (property) => {
    const payload = record(await googleJson(`https://analyticsadmin.googleapis.com/v1beta/${property.property}/dataStreams?pageSize=200`, accessToken));
    const streams = list(payload.dataStreams).map(record).flatMap((stream) => {
      const defaultUri = text(record(stream.webStreamData).defaultUri);
      if (!defaultUri) return [];
      return [{
        name: text(stream.name),
        displayName: text(stream.displayName),
        defaultUri,
        domain: normalizedDomain(defaultUri),
      }];
    });
    const matchesWebsite = streams.some((stream) => stream.domain === requestedDomain);
    return {
      ...property,
      streams,
      matchesWebsite,
      matchedDomain: matchesWebsite ? requestedDomain : null,
    };
  }));
  const matches = propertiesWithStreams.filter((property) => property.matchesWebsite);
  if (!matches.length) throw new Error(`No GA4 web data stream matches ${requestedDomain}. Connect or configure the Analytics property for this website.`);
  if (!requestedProperty && matches.length > 1) {
    return {
      externalAccountId: null,
      metadata: {
        selectionRequired: true,
        requestedDomain,
        propertyCount: propertiesWithStreams.length,
        availableProperties: propertiesWithStreams,
      },
    };
  }
  const selected = requestedProperty
    ? propertiesWithStreams.find((property) => property.property === requestedProperty)
    : matches[0];
  if (!selected?.matchesWebsite) throw new Error(`The selected GA4 property does not match ${requestedDomain}.`);

  const current30 = reportingDates(30);
  const previous30 = reportingDates(30, true);
  const current90 = reportingDates(90);
  const previous90 = reportingDates(90, true);
  const organicFilter = { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } };
  const totalsRequest = (dates: { startDate: string; endDate: string }) => ({
    dateRanges: [dates],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagedSessions" }, { name: "keyEvents" }],
    dimensionFilter: organicFilter,
    limit: 1,
  });
  const dailyRequest = {
    dateRanges: [{ startDate: previous90.startDate, endDate: current90.endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagedSessions" }, { name: "keyEvents" }],
    dimensionFilter: organicFilter,
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 25_000,
  };
  const trafficRequest = (dates: { startDate: string; endDate: string }) => ({
    dateRanges: [dates],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 200,
  });
  const [batchPayload, traffic30Payload, traffic90Payload] = await Promise.all([
    googleJson(`https://analyticsdata.googleapis.com/v1beta/${selected.property}:batchRunReports`, accessToken, {
      method: "POST",
      body: JSON.stringify({ requests: [totalsRequest(current30), totalsRequest(previous30), totalsRequest(current90), totalsRequest(previous90), dailyRequest] }),
    }),
    googleJson(`https://analyticsdata.googleapis.com/v1beta/${selected.property}:runReport`, accessToken, {
      method: "POST", body: JSON.stringify(trafficRequest(current30)),
    }),
    googleJson(`https://analyticsdata.googleapis.com/v1beta/${selected.property}:runReport`, accessToken, {
      method: "POST", body: JSON.stringify(trafficRequest(current90)),
    }),
  ]);
  const reports = list(record(batchPayload).reports);
  const totals30 = analyticsTotals(reports[0]);
  const prior30 = analyticsTotals(reports[1]);
  const totals90 = analyticsTotals(reports[2]);
  const prior90 = analyticsTotals(reports[3]);
  const daily = analyticsDaily(reports[4]);
  const period = (dates: { startDate: string; endDate: string }, previousDates: { startDate: string; endDate: string }, totals: ReturnType<typeof analyticsTotals>, previous: ReturnType<typeof analyticsTotals>, trafficPayload: unknown) => ({
    ...dates,
    ...totals,
    previousOrganicSessions: previous.organicSessions,
    previousOrganicActiveUsers: previous.organicActiveUsers,
    previousOrganicEngagedSessions: previous.organicEngagedSessions,
    previousOrganicKeyEvents: previous.organicKeyEvents,
    daily: daily.filter((row) => dateBetween(row.date, dates)),
    previousDaily: daily.filter((row) => dateBetween(row.date, previousDates)),
    trafficSources: analyticsTrafficSources(trafficPayload),
  });
  const currentPeriod = period(current30, previous30, totals30, prior30, traffic30Payload);
  return {
    externalAccountId: selected.property,
    metadata: {
      selectedProperty: selected,
      requestedDomain,
      availableProperties: propertiesWithStreams,
      dateRange: "Last 30 complete days",
      organicSessions: currentPeriod.organicSessions,
      organicActiveUsers: currentPeriod.organicActiveUsers,
      organicEngagedSessions: currentPeriod.organicEngagedSessions,
      organicKeyEvents: currentPeriod.organicKeyEvents,
      periods: {
        "30": currentPeriod,
        "90": period(current90, previous90, totals90, prior90, traffic90Payload),
      },
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
