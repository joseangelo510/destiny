export type ConnectionHealth = {
  connected: boolean;
  needsAttention: boolean;
  label: string;
  detail: string;
};

const RECONNECT_STATUSES = new Set(["expired", "error", "failed", "revoked", "reconnect_required"]);

export function connectionHealth(status: string | null | undefined, lastSyncedAt: string | null | undefined, now = new Date()): ConnectionHealth {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (RECONNECT_STATUSES.has(normalized)) {
    return { connected: false, needsAttention: true, label: "Reconnect needed", detail: "Google access expired or was revoked. Reconnect before Rebound SEO can refresh this website." };
  }
  if (normalized === "syncing") {
    return { connected: true, needsAttention: false, label: "Syncing", detail: "Rebound SEO is refreshing this website now." };
  }
  if (normalized !== "connected") {
    return { connected: false, needsAttention: false, label: "Not connected", detail: "Connect this source for this website." };
  }
  if (!lastSyncedAt) {
    return { connected: true, needsAttention: true, label: "Ready to sync", detail: "Authorization succeeded, but this website has not completed its first data sync." };
  }
  const syncedAt = new Date(lastSyncedAt);
  const ageDays = Number.isFinite(syncedAt.getTime()) ? (now.getTime() - syncedAt.getTime()) / 86_400_000 : Number.POSITIVE_INFINITY;
  if (ageDays > 14) {
    return { connected: true, needsAttention: true, label: "Sync overdue", detail: "This website has not refreshed in more than 14 days." };
  }
  return { connected: true, needsAttention: false, label: "Connected", detail: "This website has a recent successful sync." };
}
