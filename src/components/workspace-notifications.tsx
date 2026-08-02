"use client";

import { useEffect, useState } from "react";
import {
  notificationButtonLabel,
  unreadNotificationCount,
  type WorkspaceNotification,
} from "@/lib/product/notifications";

export function WorkspaceNotifications() {
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const unread = unreadNotificationCount(notifications);

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { error?: string; notifications?: WorkspaceNotification[] };
    if (!response.ok) setError(payload.error || "Destiny could not load notifications.");
    else {
      setNotifications(payload.notifications ?? []);
      setError("");
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => ({
        response,
        payload: await response.json().catch(() => ({})) as { error?: string; notifications?: WorkspaceNotification[] },
      }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error || "Destiny could not load notifications.");
        else setNotifications(payload.notifications ?? []);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const openNotification = async (notification: WorkspaceNotification) => {
    if (!notification.read_at) {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      if (!response.ok) {
        setError("Destiny could not mark this notification as read.");
        return;
      }
    }
    if (notification.destination_path) window.location.assign(notification.destination_path);
    else await load();
  };

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) setError("Destiny could not mark the notifications as read.");
    else await load();
  };

  return <div className="workspace-notification-center">
    <button aria-expanded={open} aria-label={notificationButtonLabel(unread)} className="workspace-notification-button" onClick={() => setOpen((current) => !current)} type="button">
      <span aria-hidden="true">◇</span>{unread > 0 && <b>{unread}</b>}
    </button>
    {open && <section aria-label="Notifications" className="workspace-notification-panel">
      <div className="notification-panel-heading"><div><strong>Notifications</strong><span>{unread} unread</span></div>{unread > 0 && <button className="text-button" onClick={() => void markAllRead()} type="button">Mark all read</button>}</div>
      {loading ? <p className="notification-empty">Loading updates…</p> : error ? <p className="notification-error" role="alert">{error}</p> : notifications.length ? notifications.map((notification) => <button className={notification.read_at ? "notification-item" : "notification-item unread"} key={notification.id} onClick={() => void openNotification(notification)} type="button"><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.body}</small></span></button>) : <p className="notification-empty">Audit updates and result links will appear here.</p>}
    </section>}
  </div>;
}
