type JsonRecord = Record<string, unknown>;

export type RankErrorClass = "transient" | "permanent";
type RetryMetadata = { c: RankErrorClass; a: number; m: string };

export function classifyRankError(message: string): RankErrorClass {
  const normalized = message.toLocaleLowerCase();
  if (/\b(?:401|402|403)\b|auth(?:entication|orization)?|payment|invalid|unsupported/.test(normalized)) return "permanent";
  if (/internal se server error|timeout|temporar|\b429\b|\b5\d\d\b|econnreset|socket/.test(normalized)) return "transient";
  return "transient";
}

function retryMetadata(value: string | null | undefined): RetryMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RetryMetadata>;
    if ((parsed.c === "transient" || parsed.c === "permanent") && Number.isInteger(parsed.a) && Number(parsed.a) > 0) {
      return { c: parsed.c, a: Number(parsed.a), m: typeof parsed.m === "string" ? parsed.m : "Rank check failed." };
    }
  } catch { /* Legacy plain-text errors start a new bounded retry sequence. */ }
  return null;
}

export function rankRetryPlan(message: string, previousLastError: string | null | undefined, now = new Date()) {
  const classification = classifyRankError(message);
  const previous = retryMetadata(previousLastError);
  const attempt = previous?.c === classification ? previous.a + 1 : 1;
  const state = classification === "permanent" || attempt >= 4 ? "degraded" as const : "retrying" as const;
  const transientHours = [1, 6, 24, 72];
  const delayHours = classification === "permanent" ? 24 * 7 : attempt <= transientHours.length ? transientHours[attempt - 1] : 24 * 7;
  const compactMessage = message.replace(/\s+/g, " ").trim().slice(0, 240) || "Rank check failed.";
  return {
    classification,
    attempt,
    state,
    nextCheckAt: new Date(now.getTime() + delayHours * 3_600_000).toISOString(),
    lastError: JSON.stringify({ c: classification, a: attempt, m: compactMessage } satisfies RetryMetadata),
  };
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}

function matchesDomain(candidate: string, target: string) {
  return candidate === target || candidate.endsWith(`.${target}`);
}

function itemDomain(item: JsonRecord) {
  const supplied = typeof item.domain === "string" ? normalizeDomain(item.domain) : "";
  if (supplied) return supplied;
  if (typeof item.url !== "string") return "";
  try { return normalizeDomain(new URL(item.url).hostname); }
  catch { return ""; }
}

export function parseRankObservation(payload: unknown, targetDomain: string, requestedAt = new Date()) {
  const root = record(payload);
  const task = record(list(root.tasks)[0]);
  if (Number(task.status_code ?? 0) !== 20000) throw new Error(String(task.status_message || "DataForSEO did not complete this rank check."));
  const result = record(list(task.result)[0]);
  const target = normalizeDomain(targetDomain);
  const matches = list(result.items).map(record).filter((item) => item.type === "organic" && matchesDomain(itemDomain(item), target));
  const best = matches.sort((left, right) => Number(left.rank_group ?? 999) - Number(right.rank_group ?? 999))[0];
  const position = best && Number.isInteger(Number(best.rank_group)) ? Number(best.rank_group) : null;
  const providerDatetime = typeof result.datetime === "string" ? new Date(result.datetime.replace(" ", "T")) : requestedAt;
  const observedAt = Number.isNaN(providerDatetime.getTime()) ? requestedAt.toISOString() : providerDatetime.toISOString();
  return {
    found: position !== null,
    position,
    resultUrl: typeof best?.url === "string" ? best.url : null,
    resultTitle: typeof best?.title === "string" ? best.title : null,
    observedAt,
    providerTaskId: typeof task.id === "string" ? task.id : null,
    providerCost: Number(task.cost ?? 0),
    checkUrl: typeof result.check_url === "string" ? result.check_url : null,
    evidence: {
      providerStatusCode: Number(task.status_code),
      providerDatetime: typeof result.datetime === "string" ? result.datetime : null,
      seDomain: typeof result.se_domain === "string" ? result.se_domain : null,
      matchedDomain: best ? itemDomain(best) : null,
      organicRank: position,
    },
  };
}
