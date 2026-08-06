"use client";

import { FormEvent, useState } from "react";

export function WordPressIntegrationAction({ connected, websiteId, savedSiteUrl }: { connected: boolean; websiteId: string; savedSiteUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(connected);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const response = await fetch("/api/integrations/cms/wordpress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId,
        siteUrl: values.get("siteUrl"),
        username: values.get("username"),
        applicationPassword: values.get("applicationPassword"),
      }),
    });
    const payload = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "WordPress could not be connected.");
      return;
    }
    setSuccess(true);
    setOpen(false);
  }

  return <div className="cms-connect-action">
    <button className="secondary-button" onClick={() => setOpen((value) => !value)} type="button">{success ? "Reconnect WordPress" : "Connect WordPress"}</button>
    {savedSiteUrl && success && <small>Connected to {savedSiteUrl}</small>}
    {open && <form className="cms-connect-form" onSubmit={submit}>
      <label>WordPress website URL<input name="siteUrl" defaultValue={savedSiteUrl} placeholder="https://yourwebsite.com" required type="url" /></label>
      <label>WordPress username or email<input autoComplete="username" name="username" placeholder="editor@example.com" required /></label>
      <label>Application Password<input autoComplete="new-password" name="applicationPassword" placeholder="xxxx xxxx xxxx xxxx" required type="password" /><small>Use a revocable WordPress Application Password—not your normal login password.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving} type="submit">{saving ? "Verifying…" : "Verify & connect"}</button>
    </form>}
  </div>;
}
