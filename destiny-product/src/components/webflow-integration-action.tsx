"use client";

import { FormEvent, useState } from "react";

type DiscoveredCollection = {
  id: string;
  displayName: string;
  compatible: boolean;
  reason?: string;
  bodyFields?: { slug: string; label: string }[];
};

type DiscoveredSite = {
  id: string;
  displayName: string;
  shortName: string;
  collections: DiscoveredCollection[];
};

export function WebflowIntegrationAction({ connected, websiteId, savedSummary }: { connected: boolean; websiteId: string; savedSummary?: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(connected);
  const [token, setToken] = useState("");
  const [sites, setSites] = useState<DiscoveredSite[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [selectedBodyField, setSelectedBodyField] = useState("");
  const [connectedSummary, setConnectedSummary] = useState(savedSummary ?? "");

  const reset = () => {
    setSites([]);
    setSelectedCollection("");
    setSelectedBodyField("");
    setToken("");
    setError("");
  };

  async function discover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const apiToken = String(values.get("apiToken") ?? "");
    const response = await fetch("/api/integrations/cms/webflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discover", websiteId, apiToken }),
    });
    const payload = await response.json() as { error?: string; sites?: DiscoveredSite[] };
    setSaving(false);
    if (!response.ok || !payload.sites?.length) {
      setError(payload.error || "Webflow could not be verified. Check the site API token.");
      return;
    }
    setToken(apiToken);
    setSites(payload.sites);
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollection) {
      setError("Choose a compatible CMS collection.");
      return;
    }
    const site = sites.find((item) => item.collections.some((collection) => collection.id === selectedCollection));
    if (!site) {
      setError("Choose a compatible CMS collection.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/integrations/cms/webflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", websiteId, apiToken: token, siteId: site.id, collectionId: selectedCollection, bodyField: selectedBodyField || undefined }),
    });
    const payload = await response.json() as { error?: string; connected?: boolean; siteName?: string; collectionName?: string };
    setSaving(false);
    if (!response.ok || !payload.connected) {
      setError(payload.error || "Webflow could not be connected.");
      return;
    }
    setSuccess(true);
    setConnectedSummary(`${payload.siteName ?? "Webflow site"} · ${payload.collectionName ?? "CMS collection"}`);
    setOpen(false);
    reset();
  }

  const collectionChoices = sites.flatMap((site) => site.collections.map((collection) => ({ site, collection })));
  const activeChoice = collectionChoices.find(({ collection }) => collection.id === selectedCollection);
  const bodyFieldOptions = activeChoice?.collection.bodyFields ?? [];

  return <div className="cms-connect-action">
    <button className="secondary-button" onClick={() => { setOpen((value) => !value); if (open) reset(); }} type="button">{success ? "Reconnect Webflow" : "Connect Webflow"}</button>
    {connectedSummary && success && <small>Connected to {connectedSummary}</small>}
    {open && !sites.length && <form className="cms-connect-form" onSubmit={discover}>
      <label>Webflow site API token<input autoComplete="off" name="apiToken" placeholder="Site settings → Apps & integrations → API access" required type="password" /><small>Create a site token with CMS read and write access only. It is stored encrypted on the server and never shown again.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving} type="submit">{saving ? "Verifying…" : "Verify & load collections"}</button>
    </form>}
    {open && sites.length > 0 && <form className="cms-connect-form" onSubmit={connect}>
      <fieldset className="cms-collection-picker">
        <legend>Choose the CMS collection for approved articles</legend>
        {collectionChoices.map(({ site, collection }) => <label className={collection.compatible ? "" : "incompatible"} key={collection.id}>
          <input
            checked={selectedCollection === collection.id}
            disabled={!collection.compatible}
            name="collection"
            onChange={() => { setSelectedCollection(collection.id); setSelectedBodyField(""); }}
            type="radio"
            value={collection.id}
          />
          <span><strong>{collection.displayName}</strong><small>{site.displayName}{collection.compatible ? "" : ` — ${collection.reason ?? "Not compatible."}`}</small></span>
        </label>)}
      </fieldset>
      {bodyFieldOptions.length > 1 && <label>Article body field<select onChange={(event) => setSelectedBodyField(event.target.value)} value={selectedBodyField || bodyFieldOptions[0].slug}>{bodyFieldOptions.map((field) => <option key={field.slug} value={field.slug}>{field.label}</option>)}</select><small>Rebound SEO places the article HTML in this rich-text field.</small></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving || !selectedCollection} type="submit">{saving ? "Connecting…" : "Connect collection"}</button>
      <button className="secondary-button" onClick={reset} type="button">Use a different token</button>
    </form>}
  </div>;
}
