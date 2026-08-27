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

export type RankDigestReceiptLookupFailure = {
  checkedAt: string;
  errorClass: "http_error" | "invalid_response" | "network_error" | "timeout";
  httpStatus: number | null;
  message: string;
  messageId: string;
};

type ReceiptLookupStore = ReconciliationStore & {
  updateAttempt: (sendId: string, update: { last_checked_at: string }) => Promise<unknown>;
  logFailure: (failure: RankDigestReceiptLookupFailure) => void;
};

type ReceiptLookupInput = {
  apiKey: string;
  messageId: string;
  checkedAt: string;
  fetcher?: typeof fetch;
};

function providerMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const message = (value as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() ? message.trim().slice(0, 300) : fallback;
}

function exceptionClass(cause: unknown): "network_error" | "timeout" {
  if (!(cause instanceof Error)) return "network_error";
  return /timeout/i.test(`${cause.name} ${cause.message}`) ? "timeout" : "network_error";
}

async function lookupProviderReceipt(input: ReceiptLookupInput) {
  const fetcher = input.fetcher ?? fetch;
  try {
    const response = await fetcher(`https://api.resend.com/emails/${encodeURIComponent(input.messageId)}`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as { last_event?: unknown; message?: unknown };
    if (!response.ok) {
      return {
        ok: false as const,
        failure: {
          checkedAt: input.checkedAt,
          errorClass: "http_error" as const,
          httpStatus: response.status,
          message: providerMessage(payload, `Email provider returned HTTP ${response.status}.`),
          messageId: input.messageId,
        },
      };
    }
    if (typeof payload.last_event !== "string" || !payload.last_event.trim()) {
      return {
        ok: false as const,
        failure: {
          checkedAt: input.checkedAt,
          errorClass: "invalid_response" as const,
          httpStatus: response.status,
          message: "Email provider response did not include a delivery event.",
          messageId: input.messageId,
        },
      };
    }
    return { ok: true as const, event: payload.last_event };
  } catch (cause) {
    return {
      ok: false as const,
      failure: {
        checkedAt: input.checkedAt,
        errorClass: exceptionClass(cause),
        httpStatus: null,
        message: cause instanceof Error ? cause.message.slice(0, 300) : "Email provider lookup failed.",
        messageId: input.messageId,
      },
    };
  }
}

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

export async function reconcileRankDigestProviderReceipt(
  send: RankDigestSendForReconciliation,
  input: ReceiptLookupInput,
  store: ReceiptLookupStore,
) {
  const lookup = await lookupProviderReceipt(input);
  if (!lookup.ok) {
    await store.updateAttempt(send.id, { last_checked_at: input.checkedAt });
    store.logFailure(lookup.failure);
    return lookup;
  }

  const receipt = await reconcileRankDigestSend(send, lookup.event, input.checkedAt, store);
  return { ok: true as const, receipt };
}
