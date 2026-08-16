"use client";

import { useEffect, useState } from "react";
import {
  notificationButtonLabel,
  unreadNotificationCount,
  type WorkspaceNotification,
} from "../lib/product/notifications";

async function fetchWorkspaceNotifications(websiteId: string | null, commsEnabled: boolean) {
  if (!websiteId) return { notifications: [] as WorkspaceNotification[], error: "" };
  const standardResponse = await fetch(`/api/notifications?site=${encodeURIComponent(websiteId)}`, { cache: "no-store" });
  if (!commsEnabled) {
    const standard = await standardResponse.json().catch(() => ({})) as { error?: string; notifications?: WorkspaceNotification[] };
    if (!standardResponse.ok) return { notifications: [] as WorkspaceNotification[], error: standard.error || "Destiny could not load notifications." };
    return { notifications: standard.notifications ?? [], error: "" };
  }
  const digestResponse = await fetch(`/api/comms/digest?site=${encodeURIComponent(websiteId)}`, { cache: "no-store" });
  const [standard, digest] = await Promise.all([
    standardResponse.json().catch(() => ({})) as Promise<{ error?: string; notifications?: WorkspaceNotification[] }>,
    digestResponse.json().catch(() => ({})) as Promise<{ error?: string; notifications?: WorkspaceNotification[] }>,
  ]);
  if (!standardResponse.ok) return { notifications: [] as WorkspaceNotification[], error: standard.error || "Destiny could not load notifications." };
  if (!digestResponse.ok) return { notifications: standard.notifications ?? [], error: digest.error || "Destiny could not load grouped updates." };
  return { notifications: [...(digest.notifications ?? []), ...(standard.notifications ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 12), error: "" };
}

export function WorkspaceNotifications({ websiteId, commsEnabled = false }: { websiteId: string | null; commsEnabled?: boolean }) {
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(websiteId));
  const [error, setError] = useState("");
  const unread = unreadNotificationCount(notifications);

  const load = async () => {
    setLoading(true);
    if (!websiteId) return;
    const payload = await fetchWorkspaceNotifications(websiteId, commsEnabled);
    setNotifications(payload.notifications);
    setError(payload.error);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    if (!websiteId) {
      return () => { active = false; };
    }
    void fetchWorkspaceNotifications(websiteId, commsEnabled)
      .then((payload) => {
        if (!active) return;
        setError(payload.error);
        setNotifications(payload.notifications);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Destiny could not load notifications.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [websiteId, commsEnabled]);

  const openNotification = async (notification: WorkspaceNotification) => {
    if (notification.source === "comms_batch" && notification.message_id) {
      const response = await fetch(`/api/comms/digest?site=${encodeURIComponent(websiteId ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: notification.message_id }),
      });
      if (!response.ok) {
        setError("Destiny could not dismiss this grouped update.");
        return;
      }
    }
    if (!notification.read_at) {
      if (notification.source === "comms_batch") {
        if (notification.destination_path) window.location.assign(notification.destination_path);
        else await load();
        return;
      }
      const response = await fetch(`/api/notifications?site=${encodeURIComponent(websiteId ?? "")}`, {
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
    const digestMessageIds = notifications.flatMap((notification) => notification.source === "comms_batch" && notification.message_id ? [notification.message_id] : []);
    const [response, digestResponse] = await Promise.all([
      fetch(`/api/notifications?site=${encodeURIComponent(websiteId ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }),
      digestMessageIds.length ? fetch(`/api/comms/digest?site=${encodeURIComponent(websiteId ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: digestMessageIds }),
      }) : Promise.resolve(new Response(null, { status: 200 })),
    ]);
    if (!response.ok || !digestResponse.ok) setError("Destiny could not mark the notifications as read.");
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
