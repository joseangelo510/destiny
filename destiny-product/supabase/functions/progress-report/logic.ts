export type ProgressReportItem = {
  title: string;
  detail: string;
  evidence?: "verified" | "reported";
  at?: string | null;
};

export type ProgressReportSummary = {
  stats: { done: number; needsUser: number; inMotion: number; stuck: number };
  done: ProgressReportItem[];
  owners: {
    you: ProgressReportItem[];
    rebound: ProgressReportItem[];
    google: ProgressReportItem[];
  };
  blockers: ProgressReportItem[];
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sentence(value: string) {
  return value ? `${value[0].toLocaleUpperCase("en-US")}${value.slice(1)}` : "Untitled item";
}

function receiptValue(receipt: JsonRecord, camel: string, snake: string) {
  return receipt[camel] ?? receipt[snake];
}

function hasCompletePublicEvidence(receipt: JsonRecord) {
  const permalink = text(receiptValue(receipt, "remotePermalink", "remote_permalink"));
  const verifiedAt = text(receiptValue(receipt, "verifiedLiveAt", "verified_live_at"));
  const evidence = record(receiptValue(receipt, "verificationEvidence", "verification_evidence"));
  const status = Number(evidence.httpStatus);
  let validPermalink = false;
  try {
    validPermalink = new URL(permalink).protocol === "https:";
  } catch {
    validPermalink = false;
  }
  return validPermalink
    && Boolean(verifiedAt)
    && !Number.isNaN(Date.parse(verifiedAt))
    && evidence.verified === true
    && Number.isFinite(status)
    && status >= 200
    && status < 300
    && evidence.canonicalMatches === true
    && evidence.contentMatches === true
    && evidence.indexable === true;
}

function keywordFromReceipt(receipt: JsonRecord) {
  const articleKey = text(receiptValue(receipt, "articleKey", "article_key"));
  const separator = articleKey.indexOf(":");
  return sentence(separator >= 0 ? articleKey.slice(separator + 1).trim() : articleKey);
}

export function buildProgressReportSummary(input: { quests: unknown[]; scheduleItems: unknown[]; receipts: unknown[] }): ProgressReportSummary {
  const quests = input.quests.map(record);
  const scheduleItems = input.scheduleItems.map(record);
  const done = quests
    .filter((quest) => text(quest.status) === "complete")
    .map((quest): ProgressReportItem => ({
      title: text(quest.title) || "Completed move",
      detail: text(quest.description) || "Completed in the saved plan.",
      evidence: text(quest.verification_status) === "verified" ? "verified" : "reported",
      at: text(quest.completed_at) || null,
    }))
    .sort((left, right) => (right.at || "").localeCompare(left.at || ""));
  const you = quests
    .filter((quest) => !new Set(["complete", "skipped"]).has(text(quest.status)))
    .map((quest): ProgressReportItem => ({
      title: text(quest.title) || "Open move",
      detail: text(quest.description) || "Ready in your plan.",
    }));
  const rebound = scheduleItems
    .filter((item) => ["planned", "scheduled", "managed_externally"].includes(text(item.state)))
    .map((item): ProgressReportItem => ({
      title: text(item.title) || sentence(text(item.keyword)),
      detail: text(item.scheduled_for) || "Saved publishing plan",
    }));
  const google = input.receipts.map(record).flatMap((receipt): ProgressReportItem[] => {
    const status = text(receiptValue(receipt, "publicationStatus", "publication_status"));
    if (status !== "published_unverified" && !(status === "verified_live" && !hasCompletePublicEvidence(receipt))) return [];
    return [{ title: keywordFromReceipt(receipt), detail: "Published and waiting on complete public verification." }];
  });
  const blockers = [
    ...quests
      .filter((quest) => text(quest.guidance_state) === "blocked")
      .map((quest): ProgressReportItem => ({
        title: text(quest.title) || "Blocked move",
        detail: text(quest.blocker_reason) || "This move is blocked in the saved plan.",
      })),
    ...scheduleItems
      .filter((item) => text(item.state) === "failed")
      .map((item): ProgressReportItem => ({
        title: text(item.title) || sentence(text(item.keyword)),
        detail: text(item.last_error) || "The saved publishing item failed.",
      })),
  ];

  return {
    stats: { done: done.length, needsUser: you.length, inMotion: rebound.length + google.length, stuck: blockers.length },
    done,
    owners: { you, rebound, google },
    blockers,
  };
}
