import { describe, expect, it } from "vitest";
import { batchNotificationEvents, canDeliverWeeklyChannel } from "./batching";
import { eventRoute, type NotificationEvent, type NotificationEventType } from "./contracts";

function event(index: number, type: NotificationEventType = "quest.action_completed"): NotificationEvent {
  return {
    eventId: `event-${index}`,
    accountId: "account-1",
    websiteId: "website-1",
    userId: "user-1",
    occurredAtUtc: `2026-08-15T12:${String(index).padStart(2, "0")}:00.000Z`,
    userTimezone: "America/Los_Angeles",
    type,
    ...eventRoute(type),
    groupingKey: "website-1:backlinks",
    dedupeKey: `quest-${index}`,
    render: { title: `Backlink ${index} verified`, objectUrl: "/backlinks" },
    payload: {},
  };
}

describe("Destiny event batching", () => {
  it("groups ten backlink events into one row", () => {
    const result = batchNotificationEvents(Array.from({ length: 10 }, (_, index) => event(index)));
    expect(result.deliverNow).toEqual([]);
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]).toMatchObject({ count: 10, title: "10 updates: Backlink 9 verified" });
  });

  it("deduplicates retries by dedupe key", () => {
    const duplicate = { ...event(1), eventId: "retry", occurredAtUtc: "2026-08-15T13:00:00.000Z" };
    const result = batchNotificationEvents([event(1), duplicate]);
    expect(result.batches[0].count).toBe(1);
    expect(result.batches[0].events[0].eventId).toBe("retry");
  });

  it("lets a critical indexation alarm bypass batching", () => {
    const alarm = event(11, "alarm.indexation_collapse");
    const result = batchNotificationEvents([event(1), alarm]);
    expect(result.deliverNow).toEqual([alarm]);
    expect(result.batches[0].count).toBe(1);
  });

  it("caps non-transactional channels while exempting alarms", () => {
    const receipts = [
      { channel: "email" as const, occurredAtUtc: "2026-08-11T12:00:00Z", transactional: false, alarm: false },
      { channel: "email" as const, occurredAtUtc: "2026-08-12T12:00:00Z", transactional: false, alarm: false },
      { channel: "push" as const, occurredAtUtc: "2026-08-12T12:00:00Z", transactional: false, alarm: false },
    ];
    const window = { receipts, weekStartAt: "2026-08-10T00:00:00Z", weekEndAt: "2026-08-17T00:00:00Z" };
    expect(canDeliverWeeklyChannel({ channel: "email", ...window })).toBe(false);
    expect(canDeliverWeeklyChannel({ channel: "push", ...window })).toBe(false);
    expect(canDeliverWeeklyChannel({ channel: "email", ...window, alarm: true })).toBe(true);
  });
});
