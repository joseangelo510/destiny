"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseWebsiteSelection, type WebsiteSelection } from "@/lib/billing/website-selection";
import styles from "./pricing.module.css";
export function ManagedWebsites({ initial }: { initial: WebsiteSelection | null }) {
  const [selection, setSelection] = useState(initial);
  const [selected, setSelected] = useState(initial?.selected ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const { data, error: failure } = await createClient().functions.invoke("billing", { body: { action: "select_sites", websiteIds: selected } });
      const next = !failure && parseWebsiteSelection(data);
      if (!next) throw new Error("Your selection was not saved. Check your current allowance and try again.");
      setSelection(next); setSelected(next.selected); setMessage("Managed websites saved. Your other websites and reports remain available.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your selection could not be saved."); }
    finally { setSaving(false); }
  }
  return <section className={styles.summary} aria-label="Managed websites">
    <h2>Managed websites</h2>
    {!selection ? <p role="status">Website selection is temporarily unavailable. Your saved websites are still available.</p> : <>
      <p>Choose up to {selection.capacity} website{selection.capacity === 1 ? "" : "s"} for your current allowance. Your plan’s content and research credits are shared across these websites.</p>
      <p>All saved websites and reports stay available. Selecting a website does not start a subscription or a new free trial.</p>
      <fieldset className={styles.siteChoices} disabled={saving}><legend>{selected.length} of {selection.capacity} selected</legend>
        {selection.websites.map(site => <label key={site.id}><input type="checkbox" checked={selected.includes(site.id)} disabled={!selected.includes(site.id) && selected.length >= selection.capacity} onChange={event => { setSelected(current => event.target.checked ? [...current, site.id] : current.filter(id => id !== site.id)); setMessage(""); }} /><span><strong>{site.name}</strong><small>{site.domain}</small></span></label>)}
      </fieldset>
      {selected.length > selection.capacity && <p role="alert">Your saved selection exceeds this plan. Choose which websites should remain managed before starting more paid work.</p>}
      {!selection.websites.length && <p>You do not own a saved website yet. Team websites are managed by their account owner.</p>}
      <button className={styles.button} disabled={saving || selected.length > selection.capacity || !selection.websites.length} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save managed websites"}</button>
    </>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
