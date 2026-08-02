import { describe, expect, it } from "vitest";
import {
  type WorkspaceNotification,
  notificationButtonLabel,
  unreadNotificationCount,
} from "./notifications";

function make(overrides: Partial<WorkspaceNotification> = {}): WorkspaceNotification {
  return {
    id: "a",
    kind: "info",
    title: "Test notification",
    body: "Something happened.",
    destination_path: null,
    read_at: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("unreadNotificationCount", () => {
  it("counts one unread and ignores one read", () => {
    const notifications = [
      make({ id: "1", read_at: null }),
      make({ id: "2", read_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(unreadNotificationCount(notifications)).toBe(1);
  });

  it("returns zero when every notification is read", () => {
    expect(unreadNotificationCount([make({ read_at: "2026-08-01T00:00:00Z" })])).toBe(0);
  });

  it("returns zero for an empty list", () => {
    expect(unreadNotificationCount([])).toBe(0);
  });
});

describe("notificationButtonLabel", () => {
  it("includes the unread count when notifications are unread", () => {
    const notifications = [
      make({ id: "1", read_at: null }),
      make({ id: "2", read_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(notificationButtonLabel(notifications)).toBe("Open notifications, 1 unread");
  });

  it("omits the count when all notifications are read", () => {
    const notifications = [make({ read_at: "2026-08-01T00:00:00Z" })];
    expect(notificationButtonLabel(notifications)).toBe("Open notifications");
  });

  it("omits the count for an empty list", () => {
    expect(notificationButtonLabel([])).toBe("Open notifications");
  });
});
