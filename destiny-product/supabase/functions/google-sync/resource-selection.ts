import type { GoogleSyncResult } from "./google.ts";

function resourceId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function googleResourceRequest(explicitResource: unknown, savedResource: unknown) {
  const explicit = resourceId(explicitResource);
  if (explicit) return { resourceId: explicit, recoverSavedMismatch: false };
  const saved = resourceId(savedResource);
  return { resourceId: saved, recoverSavedMismatch: Boolean(saved) };
}

export function googleSyncPersistence(result: GoogleSyncResult, provider: string, syncedAt: string) {
  if (result.metadata.selectionRequired === true) {
    return {
      external_account_id: null,
      metadata: { ...result.metadata, provider },
      status: "connected",
    };
  }
  return {
    external_account_id: result.externalAccountId,
    metadata: { ...result.metadata, provider, syncedAt },
    last_synced_at: syncedAt,
    status: "connected",
  };
}
