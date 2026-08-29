"use client";

import { WorkspaceLink as Link } from "./workspace-link";
import { FormEvent, useState } from "react";
import type { DirectoryRecommendation } from "@/lib/distribution/recommendations";

export type DirectoryProfile = {
  directory_key: string;
  profile_url: string | null;
  status: string;
  http_status: number | null;
  last_checked_at: string | null;
  public_rating: number | null;
  public_review_count: number | null;
};

export function DirectoryProfileRegistry({ directories, googleConnected, initialProfiles, websiteId }: {
  directories: DirectoryRecommendation[];
  googleConnected: boolean;
  initialProfiles: DirectoryProfile[];
  websiteId: string;
}) {
  const [profiles, setProfiles] = useState(() => new Map(initialProfiles.map((item) => [item.directory_key, item])));
  const [values, setValues] = useState(() => Object.fromEntries(initialProfiles.map((item) => [item.directory_key, item.profile_url ?? ""])));
  const [saving, setSaving] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  async function save(event: FormEvent, directoryKey: string) {
    event.preventDefault();
    setSaving(directoryKey);
    setMessage((current) => ({ ...current, [directoryKey]: "" }));
    const response = await fetch("/api/directory-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, directoryKey, profileUrl: values[directoryKey] ?? "" }) });
    const payload = await response.json() as { profile?: DirectoryProfile; error?: string };
    if (!response.ok || !payload.profile) setMessage((current) => ({ ...current, [directoryKey]: payload.error || "Rebound SEO could not save this URL." }));
    else {
      setProfiles((current) => new Map(current).set(directoryKey, payload.profile as DirectoryProfile));
      setValues((current) => ({ ...current, [directoryKey]: payload.profile?.profile_url ?? "" }));
      setMessage((current) => ({ ...current, [directoryKey]: payload.profile?.profile_url ? "Saved for public-profile monitoring." : "Profile URL removed." }));
    }
    setSaving(null);
  }

  async function remove(directoryKey: string) {
    setSaving(directoryKey);
    setMessage((current) => ({ ...current, [directoryKey]: "" }));
    const response = await fetch("/api/directory-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, directoryKey, remove: true }) });
    const payload = await response.json() as { profile?: DirectoryProfile; error?: string };
    if (!response.ok || !payload.profile) setMessage((current) => ({ ...current, [directoryKey]: payload.error || "Rebound SEO could not remove this URL." }));
    else {
      setProfiles((current) => new Map(current).set(directoryKey, payload.profile as DirectoryProfile));
      setValues((current) => ({ ...current, [directoryKey]: "" }));
      setMessage((current) => ({ ...current, [directoryKey]: "Profile URL removed." }));
    }
    setSaving(null);
  }

  async function check(directoryKey: string) {
    setChecking(directoryKey);
    setMessage((current) => ({ ...current, [directoryKey]: "" }));
    const response = await fetch("/api/directory-profiles/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, directoryKey }) });
    const payload = await response.json() as { profile?: DirectoryProfile; error?: string };
    if (!response.ok || !payload.profile) setMessage((current) => ({ ...current, [directoryKey]: payload.error || "Rebound SEO could not verify this profile." }));
    else {
      setProfiles((current) => new Map(current).set(directoryKey, payload.profile as DirectoryProfile));
      setMessage((current) => ({ ...current, [directoryKey]: payload.profile?.status === "verified" ? "Public profile is reachable." : `The directory returned HTTP ${payload.profile?.http_status ?? "unknown"}.` }));
    }
    setChecking(null);
  }

  return <div className="directory-registry">
    {directories.map((directory) => {
      const profile = profiles.get(directory.key);
      const connected = directory.key === "google-business-profile" && googleConnected;
      return <article className="directory-profile-card" key={directory.key}>
        <div className="directory-profile-heading"><div><strong>{directory.name}</strong><span className={`status-chip ${connected || profile?.status === "verified" ? "" : "amber"}`}>{connected ? "Connected" : profile?.status === "verified" ? "Public profile verified" : profile?.profile_url ? "URL saved" : "Not monitored"}</span></div><a href={directory.href} rel="noreferrer" target="_blank">Open directory ↗</a></div>
        <p>{directory.detail}</p>
        {profile?.public_rating !== null && profile?.public_rating !== undefined ? <div className="directory-public-stats"><b>{Number(profile.public_rating).toFixed(1)} rating</b><span>{profile.public_review_count ?? 0} public reviews</span></div> : null}
        <form onSubmit={(event) => void save(event, directory.key)}><label><span>Public profile URL</span><input aria-invalid={Boolean(message[directory.key] && !message[directory.key].startsWith("Saved") && !message[directory.key].startsWith("Profile"))} aria-label={`${directory.name} public profile URL`} onChange={(event) => setValues((current) => ({ ...current, [directory.key]: event.target.value }))} placeholder={`Paste your ${directory.name} profile URL`} type="url" value={values[directory.key] ?? ""} /></label><button className="secondary-button" disabled={saving === directory.key || !(values[directory.key] ?? "").trim()} type="submit">{saving === directory.key ? "Saving…" : "Save URL"}</button></form>
        <div className="directory-monitor-actions">{profile?.profile_url ? <><button className="text-button" disabled={checking === directory.key} onClick={() => void check(directory.key)} type="button">{checking === directory.key ? "Checking…" : "Check public profile"}</button><button className="text-button" disabled={saving === directory.key} onClick={() => void remove(directory.key)} type="button">Remove saved URL</button></> : null}{directory.key === "google-business-profile" ? <Link className="text-button" href="/integrations">{connected ? "Manage Google connection" : "Connect Google Business Profile"}</Link> : null}</div>
        <small>{profile?.last_checked_at ? `Reachability checked ${new Date(profile.last_checked_at).toLocaleString()} · HTTP ${profile.http_status ?? "unknown"}.` : "Public URL monitoring is separate from a direct provider connection."}</small>
        {message[directory.key] ? <div className={message[directory.key].startsWith("Saved") || message[directory.key].startsWith("Profile") ? "save-message" : "field-error"} role="status">{message[directory.key]}</div> : null}
      </article>;
    })}
  </div>;
}
