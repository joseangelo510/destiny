"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GoogleIntegrationAction({ connected, connectHref, provider, websiteId }: { connected: boolean; connectHref: string; provider: string; websiteId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const sync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, websiteId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not sync this connection.");
      setMessage("Synced now");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Destiny could not sync this connection.");
    } finally {
      setSyncing(false);
    }
  };

  return <div className="integration-actions">{connected && <button className="primary-button" disabled={syncing} onClick={() => void sync()} type="button">{syncing ? "Syncing…" : "Sync now"}</button>}<Link className="secondary-button integration-action" href={connectHref}>{connected ? "Reconnect" : "Connect Google"}</Link>{message && <small>{message}</small>}</div>;
}
