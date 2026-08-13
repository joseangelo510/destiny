export type DiscoveryMoment = {
  title: string;
  detail: string;
  value: string;
  label: string;
  source: string;
};

export type WitnessEntry = {
  id: string;
  title: string;
  detail: string;
  proof: string;
  source: string;
  tone: "verified" | "reported";
  occurredAt?: string | null;
};

type JourneyQuest = {
  id?: string;
  title?: string;
  status: string;
  verification_status?: string | null;
  completed_at?: string | null;
  priority?: number | null;
};

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function selectDiscoveryMoment({
  organicKeyEvents,
  searchClicks,
  searchImpressions,
}: {
  organicKeyEvents: unknown;
  searchClicks: unknown;
  searchImpressions: unknown;
}): DiscoveryMoment | null {
  const keyEvents = finiteNumber(organicKeyEvents);
  const clicks = finiteNumber(searchClicks);
  const impressions = finiteNumber(searchImpressions);

  if (keyEvents > 0) return {
    title: "Your search work created action.",
    detail: `Organic visitors completed ${Math.round(keyEvents).toLocaleString("en-US")} tracked website action${Math.round(keyEvents) === 1 ? "" : "s"} in the latest connected period.`,
    value: Math.round(keyEvents).toLocaleString("en-US"),
    label: "organic conversions",
    source: "Google Analytics",
  };
  if (clicks > 0) return {
    title: "Someone found you.",
    detail: `Google Search recorded ${Math.round(clicks).toLocaleString("en-US")} click${Math.round(clicks) === 1 ? "" : "s"} to your website in the latest connected period.`,
    value: Math.round(clicks).toLocaleString("en-US"),
    label: "search clicks",
    source: "Google Search Console",
  };
  if (impressions > 0) return {
    title: "You showed up.",
    detail: `Your website appeared ${Math.round(impressions).toLocaleString("en-US")} time${Math.round(impressions) === 1 ? "" : "s"} in Google Search in the latest connected period.`,
    value: Math.round(impressions).toLocaleString("en-US"),
    label: "search appearances",
    source: "Google Search Console",
  };
  return null;
}

export function buildWitnessLog({
  auditComplete,
  analytics,
  quests,
  searchConsole,
}: {
  auditComplete: boolean;
  analytics: { organicKeyEvents?: unknown } | null;
  quests: JourneyQuest[];
  searchConsole: { clicks?: unknown; impressions?: unknown } | null;
}): WitnessEntry[] {
  const entries: WitnessEntry[] = [];
  const discovery = selectDiscoveryMoment({
    organicKeyEvents: analytics?.organicKeyEvents,
    searchClicks: searchConsole?.clicks,
    searchImpressions: searchConsole?.impressions,
  });
  if (discovery) entries.push({
    id: "connected-discovery",
    title: discovery.label === "organic conversions" ? "Your search work created action" : discovery.title.replace(/[.!?]+$/, ""),
    detail: discovery.detail,
    proof: "Verified by connected data",
    source: discovery.source,
    tone: "verified",
  });

  const completed = quests
    .filter((quest) => quest.status === "complete")
    .sort((left, right) => {
      const byDate = String(right.completed_at ?? "").localeCompare(String(left.completed_at ?? ""));
      return byDate || Number(left.priority ?? 99) - Number(right.priority ?? 99);
    });
  for (const quest of completed) {
    const verified = quest.verification_status === "verified";
    entries.push({
      id: quest.id ?? `quest-${entries.length}`,
      title: quest.title?.trim() || "A useful step was completed",
      detail: verified
        ? "Destiny found supporting website or connected evidence for this step."
        : "You marked this work complete. Destiny will verify it when supporting evidence is available.",
      proof: verified ? "Verified by Destiny" : "Marked done by you",
      source: verified ? "Website or connected evidence" : "Your task history",
      tone: verified ? "verified" : "reported",
      occurredAt: quest.completed_at,
    });
  }

  if (auditComplete) entries.push({
    id: "audit-complete",
    title: "Your audit became a plan",
    detail: "Destiny completed the saved audit and turned its findings into your current coaching plan.",
    proof: "Verified by Destiny",
    source: "Destiny audit",
    tone: "verified",
  });
  return entries.slice(0, 8);
}

export type SeasonSnapshot = {
  activeWeeks: number;
  completedTasks: number;
  currentWeek: number;
  totalWeeks: 13;
  verifiedResults: number;
};

export function buildSeasonSnapshot({
  activeWeeks,
  quests,
  verifiedSignals,
}: {
  activeWeeks: number;
  quests: Array<{ status: string; verification_status?: string | null }>;
  verifiedSignals: number;
}): SeasonSnapshot {
  const completedTasks = quests.filter((quest) => quest.status === "complete").length;
  const verifiedTasks = quests.filter((quest) => quest.status === "complete" && quest.verification_status === "verified").length;
  const safeActiveWeeks = Math.max(0, Math.round(activeWeeks));
  return {
    activeWeeks: safeActiveWeeks,
    completedTasks,
    currentWeek: Math.min(13, safeActiveWeeks + 1),
    totalWeeks: 13,
    verifiedResults: Math.max(0, Math.round(verifiedSignals)) + verifiedTasks,
  };
}
