import { describe, expect, it } from "vitest";
import { notificationButtonLabel, unreadNotificationCount, type WorkspaceNotification } from "./notifications";

const notification = (read_at: string | null): WorkspaceNotification => ({
  id: crypto.randomUUID(),
  kind: "audit",
  title: "Your audit is ready",
  body: "Open your strategy.",
  destination_path: "/audits/example",
  read_at,
  created_at: "2026-08-01T00:00:00Z",
});

describe("workspace notifications", () => {
  it("counts only unread notifications and exposes that count to assistive technology", () => {
    expect(unreadNotificationCount([notification(null), notification("2026-08-01T01:00:00Z")])).toBe(1);
    expect(notificationButtonLabel(1)).toBe("Open notifications, 1 unread");
    expect(notificationButtonLabel(0)).toBe("Open notifications");
  });
});
