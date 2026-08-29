"use client";

import { WorkspaceLink as Link } from "./workspace-link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type GoogleResourceChoice = { id: string; label: string };

function resourceChoices(provider: string, summary: Record<string, unknown> | undefined): GoogleResourceChoice[] {
  if (!summary) return [];
  if (provider === "google_search_console") {
    return (Array.isArray(summary.availableSites) ? summary.availableSites : []).flatMap((value) => {
      const site = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      return site.matchesWebsite === true && typeof site.siteUrl === "string"
        ? [{ id: site.siteUrl, label: site.siteUrl }]
        : [];
    });
  }
  if (provider === "google_analytics") {
    return (Array.isArray(summary.availableProperties) ? summary.availableProperties : []).flatMap((value) => {
      const property = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
      return property.matchesWebsite === true && typeof property.property === "string"
        ? [{ id: property.property, label: typeof property.displayName === "string" && property.displayName.trim() ? `${property.displayName} · ${property.property}` : property.property }]
        : [];
    });
  }
  return [];
}

export function GoogleIntegrationAction({ connected, connectHref, provider, websiteId }: { connected: boolean; connectHref: string; provider: string; websiteId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [choices, setChoices] = useState<GoogleResourceChoice[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");

  const sync = async (resourceId = "") => {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, websiteId, selectedResourceId: resourceId || undefined }),
      });
      const payload = await response.json() as { error?: string; selectionRequired?: boolean; summary?: Record<string, unknown> };
      if (!response.ok) throw new Error(payload.error || "Rebound SEO could not sync this connection.");
      if (payload.selectionRequired) {
        const nextChoices = resourceChoices(provider, payload.summary);
        setChoices(nextChoices);
        setSelectedResourceId(nextChoices[0]?.id ?? "");
        setMessage("Choose the matching website property to finish syncing.");
        return;
      }
      setChoices([]);
      setSelectedResourceId("");
      setMessage("Synced now");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Rebound SEO could not sync this connection.");
    } finally {
      setSyncing(false);
    }
  };

  return <div className="integration-actions">{connected && <button className="primary-button" disabled={syncing} onClick={() => void sync()} type="button">{syncing ? "Syncing…" : "Sync now"}</button>}<Link className="secondary-button integration-action" href={connectHref}>{connected ? "Reconnect" : "Connect Google"}</Link>{choices.length > 0 && <div className="google-resource-picker"><label><span>Website property</span><select aria-label="Google website property" disabled={syncing} onChange={(event) => setSelectedResourceId(event.target.value)} value={selectedResourceId}>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><button className="primary-button" disabled={syncing || !selectedResourceId} onClick={() => void sync(selectedResourceId)} type="button">Use this property</button></div>}{message && <small>{message}</small>}</div>;
}
