import type { RankDigestOpportunity, RankDigestRow } from "./logic.ts";
import { buildRankDigest } from "./logic.ts";

type Digest = ReturnType<typeof buildRankDigest>;

export type RankDigestEmailInput = {
  siteName: string;
  domain: string;
  digest: Digest;
  opportunities: RankDigestOpportunity[];
  rankUrl: string;
  keywordStrategyUrl: string;
  accountUrl: string;
  unsubscribeUrl: string;
  firstNotice: boolean;
  isTest: boolean;
  measurement: {
    locationName: string;
    device: string;
    rangeStart: string | null;
    rangeEnd: string | null;
  };
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function measurementRange(input: RankDigestEmailInput["measurement"]) {
  const start = dateLabel(input.rangeStart);
  const end = dateLabel(input.rangeEnd);
  if (start && end && start !== end) return `${start} to ${end}`;
  return end ? `Checked ${end}` : "Latest available check";
}

function movementLabel(row: RankDigestRow) {
  if (row.milestone === "hit_1") return "Hit #1";
  if (row.milestone === "entered_top_3") return "Entered top 3";
  if (row.milestone === "entered_top_10") return "Entered top 10";
  if (row.milestone === "entered_top_100") return "Now visible";
  if (row.direction === "baseline") return "First reading";
  if (row.direction === "up") return row.change === null ? "Now visible" : `Up ${row.change} spot${row.change === 1 ? "" : "s"}`;
  if (row.direction === "down") return row.change === null ? "Not yet visible" : `Down ${Math.abs(row.change)} spot${Math.abs(row.change) === 1 ? "" : "s"}`;
  return "Held steady";
}

function positionLabel(row: RankDigestRow) {
  return row.currentFound && row.currentPosition ? `#${row.currentPosition}` : "Not yet visible";
}

function difficultyLabel(value: number | null) {
  if (value === null) return "Difficulty unavailable";
  if (value <= 39) return "Winnable difficulty";
  if (value <= 69) return "Moderate difficulty";
  return "Competitive difficulty";
}

function intentLabel(value: RankDigestOpportunity["intent"]) {
  if (value === "transactional" || value === "commercial") return "High buying intent";
  if (value === "navigational") return "Brand intent";
  return "Learning intent";
}

function trackedRows(rows: RankDigestRow[]) {
  return rows.map((row) => {
    const movement = movementLabel(row);
    const volume = Number(row.searchVolume ?? 0) > 0 ? `${Number(row.searchVolume).toLocaleString()} searches a month` : "Search volume unavailable";
    const positive = row.direction === "up" || row.milestone !== "none";
    return `<tr class="keyword-row"><td><strong>${escapeHtml(row.keyword)}</strong>${row.milestone !== "none" ? `<span class="milestone">${escapeHtml(movement)}</span>` : ""}<small>${escapeHtml(movement)} · ${escapeHtml(volume)}</small></td><td class="position">${escapeHtml(positionLabel(row))}</td><td class="change ${positive ? "positive" : row.direction === "down" ? "negative" : ""}">${escapeHtml(movement)}</td><td>${Number(row.searchVolume ?? 0) > 0 ? Number(row.searchVolume).toLocaleString() : "—"}</td></tr>`;
  }).join("");
}

function opportunityRows(opportunities: RankDigestOpportunity[]) {
  return opportunities.slice(0, 3).map((opportunity) => `<div class="opportunity"><div><strong>${escapeHtml(opportunity.keyword)}</strong><span>Est. ${opportunity.estimatedVolume.toLocaleString()} searches / mo</span></div><p>${escapeHtml(opportunity.reason)}</p><div class="chips"><span>${escapeHtml(intentLabel(opportunity.intent))}</span><span>${escapeHtml(difficultyLabel(opportunity.difficulty))}</span><span>From ${escapeHtml(opportunity.evidenceSource.replaceAll("_", " "))}</span></div></div>`).join("");
}

function textTrackedRows(rows: RankDigestRow[]) {
  return rows.map((row) => `- ${row.keyword}: ${positionLabel(row)} · ${movementLabel(row)}${Number(row.searchVolume ?? 0) > 0 ? ` · ${Number(row.searchVolume).toLocaleString()} searches/month` : ""}`).join("\n");
}

function textOpportunities(opportunities: RankDigestOpportunity[]) {
  return opportunities.map((row) => `- ${row.keyword}: estimated ${row.estimatedVolume.toLocaleString()} searches/month · ${intentLabel(row.intent)} · ${row.reason}`).join("\n");
}

function headline(digest: Digest) {
  if (!digest.rows.length) return "Your visibility starting point is ready.";
  const numberOne = digest.rows.find((row) => row.milestone === "hit_1");
  if (numberOne) return `Your rankings climbed. “${numberOne.keyword}” hit #1.`;
  if (digest.counts.enteredTop10) return `${digest.counts.enteredTop10} keyword${digest.counts.enteredTop10 === 1 ? "" : "s"} reached Google’s first page.`;
  if (digest.counts.up > digest.counts.down) return `${digest.counts.up} keyword${digest.counts.up === 1 ? "" : "s"} moved up this week.`;
  if (digest.counts.down > digest.counts.up) return "Your rankings shifted. Here is the clearest next move.";
  if (digest.hasComparison) return "Your rankings held steady this week.";
  return "Your first ranking baseline is ready.";
}

function coachAction(input: RankDigestEmailInput) {
  if (!input.digest.rows.length) return {
    text: `Choose 3 to 5 of the ${input.opportunities.length} opportunities Destiny found. Your next email will become a simple scoreboard: where you rank, what moved, and what to do next.`,
    href: input.keywordStrategyUrl,
    label: "Choose keywords to track →",
  };
  const best = input.digest.topTracked.find((row) => row.direction === "up" || row.milestone !== "none") ?? input.digest.topTracked[0];
  return {
    text: best ? `Keep momentum on “${best.keyword}.” Open Destiny to see the page and next recommended action behind this ranking.` : "Open Destiny to see the one ranking action worth doing next.",
    href: input.rankUrl,
    label: "Open this week’s ranking action →",
  };
}

export function renderRankDigestEmail(input: RankDigestEmailInput) {
  const startingPoint = input.digest.rows.length === 0;
  const coach = coachAction(input);
  const firstNotice = input.firstNotice ? `<div class="notice"><strong>New:</strong> Destiny will send this ranking update on your selected schedule. You can change it or turn it off in Account.</div>` : "";
  const visibleOpportunities = input.opportunities.slice(0, 10);
  const opportunitySummary = visibleOpportunities.length > 3 ? `<p class="more">+ ${visibleOpportunities.length - 3} more opportunities ranked inside Destiny</p>` : "";
  const opportunityContent = visibleOpportunities.length
    ? `${opportunityRows(visibleOpportunities)}${opportunitySummary}<a class="secondary-cta" href="${escapeHtml(input.keywordStrategyUrl)}">${startingPoint ? "Choose keywords to track" : "Review all opportunities"}</a>`
    : `<div class="opportunity"><strong>No additional opportunities are ready yet.</strong><p>Destiny will add recommendations here after the next audit finds relevant searches with meaningful demand.</p></div>`;
  const trackedSection = startingPoint ? "" : `<section><div class="section-heading"><div><span>Your tracked keywords</span><small>Keywords you chose · measured from Google results</small></div></div><table><thead><tr><th>Keyword</th><th>Position</th><th>Change</th><th>Searches / mo</th></tr></thead><tbody>${trackedRows(input.digest.topTracked)}</tbody></table><p class="definition"><strong>Position</strong> is where your site appeared in Google at the latest check. <strong>Change</strong> is movement since the previous comparable check. Search volume is a third-party monthly estimate.</p>${input.digest.distribution.notYetVisible ? `<p class="not-visible"><strong>Not yet visible</strong> means Google is not showing your site in the first 10 pages for that keyword. It is a starting point—not a penalty—and usually means a page needs to be created or improved.</p>` : ""}</section>`;
  const trackedMetrics = `<div class="metrics"><div class="metric"><span>Estimated search visibility</span><strong>${input.digest.visibilityPercent === null ? "—" : `${input.digest.visibilityPercent}%`}</strong><p>${input.digest.visibilityPercent === null ? "Available when tracked keywords have search-volume data." : "Modeled share of tracked-keyword searches that could reach your site."}</p><small>Estimated from live position + search volume</small></div><div class="metric"><span>Est. monthly visits</span><strong>${input.digest.estimatedMonthlyVisits === null ? "—" : input.digest.estimatedMonthlyVisits.toLocaleString()}</strong><p>${input.digest.estimatedMonthlyVisits === null ? "Available when tracked keywords have search-volume data." : "Visits these positions may earn. This is not your analytics."}</p><small>Modeled estimate · not measured traffic</small></div></div><div class="distribution"><div><strong>${input.digest.distribution.top3}</strong><span>in top 3</span></div><div><strong>${input.digest.distribution.top10}</strong><span>in top 10</span></div><div><strong>${input.digest.distribution.top20}</strong><span>in top 20</span></div><div><strong>${input.digest.distribution.top100}</strong><span>in top 100</span></div><div><strong>${input.digest.distribution.notYetVisible}</strong><span>not yet visible</span></div></div>`;
  const baselineMetrics = `<div class="baseline"><div><strong>${visibleOpportunities.length}</strong><span>useful opportunities found</span></div><div><strong>${visibleOpportunities.filter((row) => row.intent === "commercial" || row.intent === "transactional").length}</strong><span>with buying intent</span></div><div><strong>${visibleOpportunities.filter((row) => row.difficulty !== null && row.difficulty <= 39).length}</strong><span>with winnable difficulty</span></div></div><p class="definition">These are recommendations from your latest site audit and search evidence. They are not current tracked rankings. Choose keywords to begin measuring real movement.</p>`;
  const opportunitiesSection = `<section class="opportunities"><div class="section-heading"><div><span>${startingPoint ? `${visibleOpportunities.length} opportunities Destiny found` : "Opportunities Destiny found"}</span><small>Suggestions · not tracked yet</small></div></div><p>Relevant searches that are not in your tracked list. Ranked by business fit, buying intent, attainable difficulty, and meaningful search demand.</p>${opportunityContent}</section>`;
  const textHeader = `${headline(input.digest)}\n\n${input.siteName} · ${input.domain}\n${input.measurement.locationName} · ${input.measurement.device} · ${measurementRange(input.measurement)}`;
  return {
    subject: `${input.isTest ? "[Test] " : ""}${input.digest.subject}`,
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      body{margin:0;background:#eee9dd;color:#173129;font-family:Arial,Helvetica,sans-serif}.wrap{width:100%;padding:28px 10px;box-sizing:border-box}.email{max-width:600px;margin:auto;background:#f8f3e8;border:1px solid #ded7c9;border-radius:18px;overflow:hidden}.brand{padding:24px 30px;border-bottom:1px solid #ded7c9}.brand strong{font-family:Georgia,serif;font-size:24px}.brand span{float:right;color:#68766f;font-size:12px}.context{padding:18px 30px;color:#65746e;font-size:12px;line-height:1.7}.hero{padding:4px 30px 26px}.hero h1{font-family:Georgia,serif;font-size:36px;font-weight:500;line-height:1.12;margin:8px 0 12px}.hero p,section>p{color:#53645d;line-height:1.6}.notice{margin:0 30px 22px;background:#edf4ef;border:1px solid #d1e3d8;border-radius:12px;padding:14px 16px;line-height:1.5}.metrics,.baseline{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 30px 14px}.metric,.baseline>div{background:#fffdf7;border:1px solid #ded7c9;border-radius:14px;padding:18px}.metric>span{color:#65746e;font-size:12px}.metric>strong,.baseline strong{display:block;font-family:Georgia,serif;font-size:32px;font-weight:500;margin:8px 0}.metric p{font-size:12px;line-height:1.5;color:#53645d;min-height:36px}.metric small{color:#7b867f;font-size:10px}.distribution{display:grid;grid-template-columns:repeat(5,1fr);margin:4px 30px 26px;border:1px solid #ded7c9;border-radius:14px;overflow:hidden;background:#fffdf7}.distribution div{padding:13px 6px;text-align:center;border-right:1px solid #e8e1d4}.distribution div:last-child{border-right:0}.distribution strong{display:block;font-family:Georgia,serif;font-size:23px}.distribution span{font-size:10px;color:#65746e}section{padding:26px 30px;border-top:1px solid #ded7c9}.section-heading{margin-bottom:15px}.section-heading span{display:block;font-family:Georgia,serif;font-size:24px}.section-heading small{display:block;color:#65746e;margin-top:4px}table{border-collapse:collapse;width:100%;font-size:13px;background:#fffdf7;border:1px solid #ded7c9}th{text-align:left;padding:10px 9px;border-bottom:2px solid #cbd6d0;color:#65746e;font-size:10px;text-transform:uppercase;letter-spacing:.04em}td{padding:12px 9px;border-bottom:1px solid #e8e1d4;vertical-align:top}.keyword-row small{display:none}.position{font-family:Georgia,serif;font-size:18px}.positive{color:#24704f;font-weight:700}.negative{color:#9a4c43;font-weight:700}.milestone{display:inline-block;margin-left:7px;background:#e4f1e9;color:#246647;border-radius:20px;padding:3px 7px;font-size:9px;text-transform:uppercase}.definition,.not-visible{font-size:11px!important;color:#65746e!important}.not-visible{background:#fff8e7;border-left:3px solid #d5a23e;padding:12px}.opportunities{background:#fbf3df}.opportunity{background:#fffaf0;border:1px solid #e4d4ad;border-radius:13px;padding:15px;margin-top:10px}.opportunity>div:first-child{display:flex;justify-content:space-between;gap:10px}.opportunity>div:first-child span{font-size:11px;color:#786b4d}.opportunity p{font-size:12px;color:#5b5b4d}.chips span{display:inline-block;background:#f3e8ca;border-radius:20px;padding:4px 8px;margin:2px;font-size:9px;color:#665b42}.more{text-align:center;font-size:12px!important}.secondary-cta{display:inline-block;color:#245e4b;font-weight:700;margin-top:8px}.coach{margin:24px 30px 30px;background:#173d31;color:#fff;border-radius:15px;padding:22px}.coach span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#c8ddd4}.coach p{font-family:Georgia,serif;font-size:20px;line-height:1.4;margin:8px 0 18px}.coach a{color:#173d31;background:#f4d57d;padding:11px 14px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px}.footer{padding:20px 30px 30px;color:#77827c;font-size:10px;line-height:1.7}.footer a{color:#536b61}
      @media(max-width:480px){.wrap{padding:0}.email{border-radius:0;border-left:0;border-right:0}.brand,.context,.hero,section{padding-left:20px;padding-right:20px}.hero h1{font-size:29px}.metrics,.baseline{grid-template-columns:1fr;padding-left:20px;padding-right:20px}.distribution{margin-left:20px;margin-right:20px;grid-template-columns:repeat(3,1fr)}.distribution div:nth-child(3){border-right:0}.distribution div:nth-child(n+4){border-top:1px solid #e8e1d4}.distribution div:nth-child(5){border-right:0}.distribution div:nth-child(4){grid-column:1/2}.distribution div:nth-child(5){grid-column:2/4}thead{display:none}table,tbody,tr,td{display:block;width:100%;box-sizing:border-box}.keyword-row{position:relative;padding:13px;border-bottom:1px solid #e8e1d4}.keyword-row td{border:0;padding:2px 72px 2px 0}.keyword-row td:nth-child(3),.keyword-row td:nth-child(4){display:none}.keyword-row .position{position:absolute;right:13px;top:13px;padding:0;width:auto}.keyword-row small{display:block;color:#65746e;margin-top:5px;font-weight:400}.opportunity>div:first-child{display:block}.opportunity>div:first-child span{display:block;margin-top:5px}.coach{margin-left:20px;margin-right:20px}.footer{padding-left:20px;padding-right:20px}}
    </style></head><body><div class="wrap"><main class="email"><div class="brand"><strong>Destiny.</strong><span>${startingPoint ? "Visibility starting point" : "Weekly ranking update"}</span></div><div class="context"><strong>${escapeHtml(input.siteName)}</strong> · ${escapeHtml(input.domain)}<br>${escapeHtml(input.measurement.locationName)} · ${escapeHtml(input.measurement.device)} · ${escapeHtml(measurementRange(input.measurement))}</div><div class="hero"><h1>${escapeHtml(headline(input.digest))}</h1><p>${startingPoint ? "Destiny reviewed your latest search evidence. Choose the opportunities that matter, and next week this becomes your progress scoreboard." : `${input.digest.counts.up} moved up, ${input.digest.counts.down} moved down, and ${input.digest.top10Current} currently appear on Google’s first page.`}</p></div>${firstNotice}${startingPoint ? baselineMetrics : trackedMetrics}${trackedSection}${opportunitiesSection}<div class="coach"><span>What to do next</span><p>${escapeHtml(coach.text)}</p><a href="${escapeHtml(coach.href)}">${escapeHtml(coach.label)}</a></div><div class="footer">Rank positions are measured from the Google location, language, and device shown above. Search volume and traffic projections are estimates and may differ from first-party analytics.<br><a href="${escapeHtml(input.accountUrl)}">Manage notifications</a> · <a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a> · Destiny, made by Jose Angelo Studios</div></main></div></body></html>`,
    text: startingPoint
      ? `${textHeader}\n\nDestiny found ${visibleOpportunities.length} opportunities from your latest audit. These are suggestions, not current rankings.\n\n${textOpportunities(visibleOpportunities)}\n\nWhat to do next: ${coach.text}\n${coach.href}\n\nManage notifications: ${input.accountUrl}\nUnsubscribe: ${input.unsubscribeUrl}`
      : `${textHeader}\n\n${input.digest.counts.up} moved up · ${input.digest.counts.down} moved down · ${input.digest.top10Current} in the top 10\nEstimated search visibility: ${input.digest.visibilityPercent === null ? "Unavailable" : `${input.digest.visibilityPercent}%`}\nEstimated monthly visits: ${input.digest.estimatedMonthlyVisits ?? "Unavailable"}\n\nYOUR TRACKED KEYWORDS — MEASURED\n${textTrackedRows(input.digest.topTracked)}\n\nOPPORTUNITIES DESTINY FOUND — SUGGESTIONS, NOT TRACKED\n${textOpportunities(visibleOpportunities)}\n\nWhat to do next: ${coach.text}\n${coach.href}\n\nManage notifications: ${input.accountUrl}\nUnsubscribe: ${input.unsubscribeUrl}`,
  };
}
