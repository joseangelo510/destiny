import { reconcileDeliveryReceipt, type RankDigestLedgerState } from "./logic.ts";

export type RankDigestSendForReconciliation = {
  id: string;
  websiteId: string;
  status: RankDigestLedgerState;
  isTest: boolean;
};

type SendUpdate = {
  status: "accepted" | "delivered" | "failed";
  provider_event: string;
  last_checked_at: string;
  delivered_at: string | null;
  error: string | null;
};

type PreferenceUpdate = {
  last_digest_status: "accepted" | "delivered" | "failed";
  last_digest_error: string | null;
  updated_at: string;
};

type ReconciliationStore = {
  updateSend: (sendId: string, update: SendUpdate) => Promise<unknown>;
  updatePreference: (websiteId: string, update: PreferenceUpdate) => Promise<unknown>;
};

export async function reconcileRankDigestSend(
  send: RankDigestSendForReconciliation,
  providerEvent: unknown,
  checkedAt: string,
  store: ReconciliationStore,
) {
  const receipt = reconcileDeliveryReceipt(send.status, providerEvent, checkedAt);
  await store.updateSend(send.id, {
    status: receipt.status,
    provider_event: receipt.providerEvent,
    last_checked_at: receipt.checkedAt,
    delivered_at: receipt.deliveredAt,
    error: receipt.error,
  });

  if (!send.isTest) {
    await store.updatePreference(send.websiteId, {
      last_digest_status: receipt.status,
      last_digest_error: receipt.error,
      updated_at: receipt.checkedAt,
    });
  }

  return receipt;
}
