import { ALARM_EVENT_TYPES, type NotificationEvent } from "./contracts";

export type NotificationBatch = {
  groupingKey: string;
  events: NotificationEvent[];
  count: number;
  title: string;
  destinationUrl: string | null;
  latestAtUtc: string;
};

export function dedupeNotificationEvents(events: NotificationEvent[]) {
  const byDedupeKey = new Map<string, NotificationEvent>();
  for (const event of [...events].sort((left, right) => left.occurredAtUtc.localeCompare(right.occurredAtUtc))) {
    byDedupeKey.set(event.dedupeKey, event);
  }
  return [...byDedupeKey.values()];
}

export function batchNotificationEvents(events: NotificationEvent[]): { deliverNow: NotificationEvent[]; batches: NotificationBatch[] } {
  const deduped = dedupeNotificationEvents(events);
  const deliverNow = deduped.filter((event) => event.bypassBatch || event.priority === 2 || ALARM_EVENT_TYPES.has(event.type));
  const grouped = new Map<string, NotificationEvent[]>();
  for (const event of deduped) {
    if (deliverNow.includes(event)) continue;
    grouped.set(event.groupingKey, [...(grouped.get(event.groupingKey) ?? []), event]);
  }
  const batches = [...grouped.entries()].map(([groupingKey, groupedEvents]) => {
    const ordered = [...groupedEvents].sort((left, right) => right.occurredAtUtc.localeCompare(left.occurredAtUtc));
    const newest = ordered[0];
    return {
      groupingKey,
      events: ordered,
      count: ordered.length,
      title: ordered.length === 1 ? newest.render.title : `${ordered.length} updates: ${newest.render.title}`,
      destinationUrl: newest.render.objectUrl ?? null,
      latestAtUtc: newest.occurredAtUtc,
    };
  }).sort((left, right) => right.latestAtUtc.localeCompare(left.latestAtUtc));
  return { deliverNow, batches };
}

export type DeliveryReceipt = {
  channel: "email" | "push";
  occurredAtUtc: string;
  transactional: boolean;
  alarm: boolean;
};

export function canDeliverWeeklyChannel({
  channel,
  receipts,
  weekStartAt,
  weekEndAt,
  transactional = false,
  alarm = false,
}: {
  channel: "email" | "push";
  receipts: DeliveryReceipt[];
  weekStartAt: string;
  weekEndAt: string;
  transactional?: boolean;
  alarm?: boolean;
}) {
  if (transactional || alarm) return true;
  const count = receipts.filter((receipt) =>
    receipt.channel === channel
    && !receipt.transactional
    && !receipt.alarm
    && receipt.occurredAtUtc >= weekStartAt
    && receipt.occurredAtUtc < weekEndAt
  ).length;
  return count < (channel === "email" ? 2 : 1);
}
