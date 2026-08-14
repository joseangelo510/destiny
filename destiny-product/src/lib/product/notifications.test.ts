import { describe, expect, it } from "vitest";
import { notificationButtonLabel, notificationTitleForWebsite, unreadNotificationCount, type WorkspaceNotification } from "./notifications";

const notification = (read_at: string | null): WorkspaceNotification => ({
  id: crypto.randomUUID(),
  kind: "audit",
  title: "Your audit is ready",
  body: "Open your strategy.",
  destination_path: "/audits/example",
  read_at,
  created_at: "2026-08-01T00:00:00Z",
  website_id: "11111111-1111-4111-8111-111111111111",
  website_name: "Example Co",
});

describe("workspace notifications", () => {
  it("counts only unread notifications and exposes that count to assistive technology", () => {
    expect(unreadNotificationCount([notification(null), notification("2026-08-01T01:00:00Z")])).toBe(1);
    expect(notificationButtonLabel(1)).toBe("Open notifications, 1 unread");
    expect(notificationButtonLabel(0)).toBe("Open notifications");
  });

  it("identifies the website without duplicating an existing site label", () => {
    expect(notificationTitleForWebsite("Your audit is ready", "Example Co")).toBe("Example Co: Your audit is ready");
    expect(notificationTitleForWebsite("Example Co: Your audit is ready", "Example Co")).toBe("Example Co: Your audit is ready");
  });
});
