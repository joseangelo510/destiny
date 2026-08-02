"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type WorkspaceNotification,
  notificationButtonLabel,
  unreadNotificationCount,
} from "@/lib/product/notifications";

export function WorkspaceNotifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Incrementing this triggers the fetch effect without calling setState inside the effect body.
  const [fetchKey, setFetchKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Called from event handlers only — safe to call setState here.
  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setFetchKey((k) => k + 1);
  }, []);

  // All setState calls happen inside .then()/.catch() callbacks, never synchronously.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const payload = (await res.json()) as { error?: string };
          if (!cancelled) {
            setError(payload.error ?? "Failed to load notifications.");
            setLoading(false);
          }
          return;
        }
        const payload = (await res.json()) as { notifications?: WorkspaceNotification[] };
        if (!cancelled) {
          setNotifications(payload.notifications ?? []);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load notifications.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  // Close on outside click — setOpen fires inside the addEventListener callback, not synchronously.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleNotificationClick = useCallback(
    (notification: WorkspaceNotification) => {
      if (notification.read_at === null) {
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id }),
        }).catch(() => undefined);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      }
      setOpen(false);
      if (notification.destination_path) {
        router.push(notification.destination_path);
      }
    },
    [router]
  );

  const handleMarkAllRead = useCallback(() => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
      .then(() => refresh())
      .catch(() => undefined);
  }, [refresh]);

  const unread = unreadNotificationCount(notifications);
  const label = notificationButtonLabel(notifications);

  return (
    <div className="notification-center">
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className="notification-trigger"
        onClick={handleToggle}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" className="notification-count">{unread}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          aria-label="Notifications"
          className="notification-panel"
          role="dialog"
        >
          <div className="notification-panel-heading">
            <strong>Notifications</strong>
            <span>{unread > 0 ? `${unread} unread` : "All caught up"}</span>
          </div>

          {loading && (
            <p className="notification-empty">Loading notifications…</p>
          )}

          {!loading && error !== null && (
            <p className="notification-empty">{error}</p>
          )}

          {!loading && error === null && notifications.length === 0 && (
            <p className="notification-empty">No notifications yet. Check back after your first audit.</p>
          )}

          {!loading && error === null && notifications.map((notification) => (
            <button
              key={notification.id}
              className={`notification-item${notification.read_at === null ? " unread" : ""}`}
              onClick={() => handleNotificationClick(notification)}
              type="button"
            >
              <span aria-hidden="true" className="notification-dot" />
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.body}</small>
              </span>
            </button>
          ))}

          {!loading && error === null && unread > 0 && (
            <div className="notification-panel-footer">
              <button
                className="notification-mark-all"
                onClick={handleMarkAllRead}
                type="button"
              >
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
