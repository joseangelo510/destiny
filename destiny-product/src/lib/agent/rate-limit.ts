const WINDOW_MS = 60 * 60 * 1_000;
const WEBSITE_LIMIT = 30;
const USER_LIMIT = 60;
const buckets = new Map<string, number[]>();

function consume(key: string, limit: number, now: number) {
  const active = (buckets.get(key) ?? []).filter((time) => time > now - WINDOW_MS);
  if (active.length >= limit) {
    return { ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil((active[0] + WINDOW_MS - now) / 1_000)) };
  }
  active.push(now);
  buckets.set(key, active);
  return { ok: true as const };
}

export function allowAgentTurn({
  userId,
  websiteId,
  now = Date.now(),
}: {
  userId: string;
  websiteId: string;
  now?: number;
}) {
  const website = consume("website:" + websiteId, WEBSITE_LIMIT, now);
  if (!website.ok) return website;
  const user = consume("user:" + userId, USER_LIMIT, now);
  if (!user.ok) {
    buckets.get("website:" + websiteId)?.pop();
    return user;
  }
  return { ok: true as const };
}

export function resetAgentRateLimitsForTests() {
  buckets.clear();
}
