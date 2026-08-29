"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { needsWordPressScheduleVerification, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

export function useWordPressCalendarReconciliation({
  websiteId,
  websitePlatform,
  wordpressConnected,
  now,
  items,
  setItems,
  onError,
  onNotice,
  onRefresh,
}: {
  websiteId: string;
  websitePlatform: string | null;
  wordpressConnected: boolean;
  now?: string;
  items: PublishingScheduleItemRecord[];
  setItems: Dispatch<SetStateAction<PublishingScheduleItemRecord[]>>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onRefresh: () => void;
}) {
  const [verifyingItemId, setVerifyingItemId] = useState<string | null>(null);
  const referenceNow = now ?? new Date().toISOString();
  const needsVerification = useCallback((item: PublishingScheduleItemRecord) => (
    needsWordPressScheduleVerification(item, websitePlatform, wordpressConnected, referenceNow)
  ), [referenceNow, websitePlatform, wordpressConnected]);
  const overdueItems = useMemo(() => items.filter(needsVerification), [items, needsVerification]);

  const refreshStatus = useCallback(async (item: PublishingScheduleItemRecord) => {
    if (verifyingItemId || !needsVerification(item)) return;
    setVerifyingItemId(item.id);
    onError("");
    onNotice("");
    try {
      const response = await fetch("/api/content/publishing-plan/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, itemId: item.id }),
      });
      const payload = await response.json() as { error?: string; verified?: boolean; state?: PublishingScheduleItemRecord["state"]; remotePermalink?: string | null };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not verify this WordPress post.");
      if (payload.verified && payload.state === "published" && payload.remotePermalink) {
        setItems((current) => current.map((entry) => entry.id === item.id
          ? { ...entry, state: "published", remote_permalink: payload.remotePermalink ?? null, last_error: null }
          : entry));
        onNotice("WordPress confirmed that this post is live.");
      } else {
        onNotice("WordPress has not verified this post as live yet. Its scheduled status remains unchanged.");
      }
      onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Rebound SEO could not verify this WordPress post.");
    } finally {
      setVerifyingItemId(null);
    }
  }, [needsVerification, onError, onNotice, onRefresh, setItems, verifyingItemId, websiteId]);

  return { needsVerification, overdueItems, refreshStatus, verifyingItemId };
}
