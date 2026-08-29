"use client";

import { useEffect, useState } from "react";
import {
  notificationButtonLabel,
  unreadNotificationCount,
  type WorkspaceNotification,
} from "../lib/product/notifications";

export function WorkspaceNotifications({ websiteId }: { websiteId: string | null }) {
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(websiteId));
  const [error, setError] = useState("");
  const unread = unreadNotificationCount(notifications);

  const load = async () => {
    setLoading(true);
    if (!websiteId) return;
    const response = await fetch(`/api/notifications?site=${encodeURIComponent(websiteId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { error?: string; notifications?: WorkspaceNotification[] };
    if (!response.ok) setError(payload.error || "Rebound SEO could not load notifications.");
    else {
      setNotifications(payload.notifications ?? []);
      setError("");
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    if (!websiteId) {
      return () => { active = false; };
    }
    void fetch(`/api/notifications?site=${encodeURIComponent(websiteId)}`, { cache: "no-store" })
      .then(async (response) => ({
        response,
        payload: await response.json().catch(() => ({})) as { error?: string; notifications?: WorkspaceNotification[] },
      }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error || "Rebound SEO could not load notifications.");
        else setNotifications(payload.notifications ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Rebound SEO could not load notifications.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [websiteId]);

  const openNotification = async (notification: WorkspaceNotification) => {
    if (!notification.read_at) {
      const response = await fetch(`/api/notifications?site=${encodeURIComponent(websiteId ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      if (!response.ok) {
        setError("Rebound SEO could not mark this notification as read.");
        return;
      }
    }
    if (notification.destination_path) window.location.assign(notification.destination_path);
    else await load();
  };

  const markAllRead = async () => {
    const response = await fetch(`/api/notifications?site=${encodeURIComponent(websiteId ?? "")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) setError("Rebound SEO could not mark the notifications as read.");
    else await load();
  };

  return <div className="workspace-notification-center">
    <button aria-controls="workspace-notification-panel" aria-expanded={open} aria-haspopup="dialog" aria-label={notificationButtonLabel(unread)} className="workspace-notification-button" onClick={() => setOpen((current) => !current)} type="button">
      <svg aria-hidden="true" className="workspace-notification-icon" fill="none" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unread > 0 && <b>{unread}</b>}
    </button>
    {open && <section aria-label="Notifications" className="workspace-notification-panel" id="workspace-notification-panel">
      <div className="notification-panel-heading"><div><strong>Notifications</strong><span>{unread} unread</span></div>{unread > 0 && <button className="text-button" onClick={() => void markAllRead()} type="button">Mark all read</button>}</div>
      {loading ? <p className="notification-empty">Loading updates…</p> : error ? <p className="notification-error" role="alert">{error}</p> : notifications.length ? notifications.map((notification) => <button className={notification.read_at ? "notification-item" : "notification-item unread"} key={notification.id} onClick={() => void openNotification(notification)} type="button"><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.body}</small></span></button>) : <p className="notification-empty">Audit updates for this website will appear here.</p>}
    </section>}
  </div>;
}
