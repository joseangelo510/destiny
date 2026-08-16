"use client";

import { useState } from "react";
import type { CommsCadence } from "@/lib/comms/contracts";
import styles from "./account-settings.module.css";

type AccountWebsite = {
  id: string;
  businessName: string | null;
  normalizedDomain: string;
};

export function AccountSettings({ activeWebsiteId = null, initialCommsPreference, loginEmail, notificationEmail, websites = [] }: {
  activeWebsiteId?: string | null;
  initialCommsPreference?: { cadence: string; userTimezone: string; emailEnabled: boolean; pushEnabled: boolean };
  loginEmail: string;
  notificationEmail: string | null;
  websites?: AccountWebsite[];
}) {
  const [savedNotificationEmail, setSavedNotificationEmail] = useState(notificationEmail ?? "");
  const [notificationDraft, setNotificationDraft] = useState(notificationEmail ?? "");
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [cadence, setCadence] = useState<CommsCadence>((initialCommsPreference?.cadence as CommsCadence | undefined) ?? "weekly");
  const [userTimezone, setUserTimezone] = useState(initialCommsPreference?.userTimezone ?? "UTC");
  const [emailEnabled, setEmailEnabled] = useState(initialCommsPreference?.emailEnabled ?? true);
  const [pushEnabled, setPushEnabled] = useState(initialCommsPreference?.pushEnabled ?? false);
  const [savingComms, setSavingComms] = useState(false);
  const [commsStatus, setCommsStatus] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [pendingWebsite, setPendingWebsite] = useState<AccountWebsite | null>(null);
  const [websiteConfirmation, setWebsiteConfirmation] = useState("");
  const [deletingWebsite, setDeletingWebsite] = useState(false);
  const [websiteError, setWebsiteError] = useState("");
  const matches = confirmation.trim().toLowerCase() === loginEmail.toLowerCase();
  const websiteMatches = pendingWebsite
    ? websiteConfirmation.trim().toLowerCase() === pendingWebsite.normalizedDomain.toLowerCase()
    : false;

  async function saveCommunicationPreference() {
    if (!activeWebsiteId || savingComms) return;
    setSavingComms(true);
    setCommsStatus("");
    try {
      const response = await fetch(`/api/comms/preferences?site=${encodeURIComponent(activeWebsiteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, userTimezone, emailEnabled, pushEnabled }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Destiny could not save this cadence.");
      setCommsStatus("Saved for this website.");
    } catch (cause) {
      setCommsStatus(cause instanceof Error ? cause.message : "Destiny could not save this cadence.");
    } finally {
      setSavingComms(false);
    }
  }

  function beginWebsiteDeletion(website: AccountWebsite) {
    setPendingWebsite(website);
    setWebsiteConfirmation("");
    setWebsiteError("");
  }

  function cancelWebsiteDeletion() {
    if (deletingWebsite) return;
    setPendingWebsite(null);
    setWebsiteConfirmation("");
    setWebsiteError("");
  }

  async function deleteWebsite() {
    if (!pendingWebsite || !websiteMatches || deletingWebsite) return;
    setDeletingWebsite(true);
    setWebsiteError("");
    try {
      const response = await fetch(`/api/websites/${pendingWebsite.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: websiteConfirmation }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; nextWebsiteId?: string | null };
      if (!response.ok) throw new Error(result.error || "Destiny could not delete this website.");
      window.location.assign(result.nextWebsiteId ? "/account" : "/onboarding");
    } catch (cause) {
      setWebsiteError(cause instanceof Error ? cause.message : "Destiny could not delete this website.");
      setDeletingWebsite(false);
    }
  }
  const normalizedNotificationDraft = notificationDraft.trim().toLowerCase();
  const notificationEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNotificationDraft);
  const notificationEmailChanged = normalizedNotificationDraft !== savedNotificationEmail.toLowerCase();

  async function saveNotificationEmail() {
    if (!activeWebsiteId || !notificationEmailValid || !notificationEmailChanged || savingNotificationEmail) return;
    setSavingNotificationEmail(true);
    setNotificationMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: normalizedNotificationDraft, websiteId: activeWebsiteId }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; notificationEmail?: string };
      if (!response.ok || !result.notificationEmail) throw new Error(result.error || "Destiny could not save this email.");
      setSavedNotificationEmail(result.notificationEmail);
      setNotificationDraft(result.notificationEmail);
      setNotificationMessage("Audit and contact email saved.");
    } catch (cause) {
      setNotificationMessage(cause instanceof Error ? cause.message : "Destiny could not save this email.");
    } finally {
      setSavingNotificationEmail(false);
    }
  }

  async function deleteAccount() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Destiny could not delete this account.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not delete this account.");
      setDeleting(false);
    }
  }

  return <div className={styles.stack}>
    <section className={styles.card}>
      <div className={styles.heading}><span>Identity</span><h2>Your Destiny account</h2><p>These addresses can be different. One controls sign-in; the other receives website reports and updates.</p></div>
      <dl className={styles.identityList}>
        <div><dt>Login email</dt><dd>{loginEmail}</dd><p>This is the email connected to your authenticated Destiny account.</p></div>
        <div><dt>Audit and contact email</dt><dd>{savedNotificationEmail || "Not set"}</dd><p>Welcome messages and audit-ready links for the current website go here. Each website can use a different address.</p><label className={styles.emailEditor}><span>Notification email</span><input aria-label="Audit and contact email" autoComplete="email" onChange={(event) => { setNotificationDraft(event.target.value); setNotificationMessage(""); }} type="email" value={notificationDraft} /></label><button className={styles.saveButton} disabled={!activeWebsiteId || !notificationEmailValid || !notificationEmailChanged || savingNotificationEmail} onClick={() => void saveNotificationEmail()} type="button">{savingNotificationEmail ? "Saving…" : "Save notification email"}</button>{notificationMessage && <p aria-live="polite" className={notificationMessage.endsWith("saved.") ? styles.success : styles.error}>{notificationMessage}</p>}</div>
      </dl>
    </section>
    <section className={styles.card} id="communication-cadence">
      <div className={styles.heading}><span>Communication cadence</span><h2>Choose how Destiny follows up</h2><p>The setting applies to the current website. Critical crawl or indexation alarms can still bypass a muted digest.</p></div>
      {activeWebsiteId ? <div className={styles.commsForm}>
        <fieldset className={styles.cadenceOptions}>
          <legend>Email rhythm</legend>
          {([
            ["essential", "Essential only", "Transactional updates and critical alarms."],
            ["weekly", "Weekly", "Monday scorecard plus at most one continuity reminder."],
            ["guided", "Guided", "Weekly scorecard and behavior-triggered coaching."],
            ["muted", "Muted", "No non-transactional email or push."],
          ] as const).map(([value, label, detail]) => <label className={styles.cadenceOption} key={value}><input checked={cadence === value} name="cadence" onChange={() => setCadence(value)} type="radio" value={value} /><span><strong>{label}</strong><small>{detail}</small></span></label>)}
        </fieldset>
        <label className={styles.timezoneLabel}>Time zone<input list="destiny-timezones" onChange={(event) => setUserTimezone(event.target.value)} value={userTimezone} /><datalist id="destiny-timezones"><option value="UTC" /><option value="America/Los_Angeles" /><option value="America/Denver" /><option value="America/Chicago" /><option value="America/New_York" /><option value="Europe/London" /><option value="Australia/Sydney" /></datalist><small>Week deadlines and 7:15–8:15 sends use this IANA time zone.</small></label>
        <div className={styles.channelOptions}><label><input checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} type="checkbox" /> Email</label><label><input checked={pushEnabled} onChange={(event) => setPushEnabled(event.target.checked)} type="checkbox" /> Push</label></div>
        <div className={styles.commsActions}><button disabled={savingComms} onClick={() => void saveCommunicationPreference()} type="button">{savingComms ? "Saving…" : "Save cadence"}</button>{commsStatus ? <span aria-live="polite">{commsStatus}</span> : null}</div>
      </div> : <p className={styles.emptyWebsites}>Add or select a website before choosing a communication cadence.</p>}
    </section>
    <section className={styles.card}>
      <div className={styles.heading}><span>Website management</span><h2>Your websites</h2><p>Review the websites connected to this login or remove one you no longer want Destiny to manage.</p></div>
      {websites.length ? <div className={styles.websiteList}>
        {websites.map((website) => <div className={styles.websiteRow} key={website.id}>
          <div className={styles.websiteIdentity}>
            <div className={styles.websiteTitleLine}><strong>{website.businessName?.trim() || website.normalizedDomain}</strong>{website.id === activeWebsiteId ? <span className={styles.currentBadge}>Current website</span> : null}</div>
            <span>{website.normalizedDomain}</span>
          </div>
          <button className={styles.websiteDeleteButton} disabled={deletingWebsite} onClick={() => beginWebsiteDeletion(website)} type="button">Delete website</button>
        </div>)}
      </div> : <p className={styles.emptyWebsites}>No websites are connected to this account yet.</p>}
      <p className={styles.websiteSafety}>Deleting a website does not delete your Destiny account or any of your other websites.</p>
      {pendingWebsite ? <div aria-label={`Confirm deletion of ${pendingWebsite.normalizedDomain}`} className={styles.websiteDeletePanel} role="group">
        <div><strong>Delete {pendingWebsite.normalizedDomain}?</strong><p>This permanently removes this website’s audits, keywords, three-month plans, tasks, rank tracking, drafts, reviews, and connections. This cannot be undone.</p></div>
        <label className={styles.confirmation}>Type <strong>{pendingWebsite.normalizedDomain}</strong> to confirm<input autoComplete="off" autoFocus onChange={(event) => setWebsiteConfirmation(event.target.value)} placeholder={pendingWebsite.normalizedDomain} spellCheck={false} value={websiteConfirmation} /></label>
        {websiteError && <p aria-live="polite" className={styles.error}>{websiteError}</p>}
        <div className={styles.websiteDeleteActions}><button className={styles.cancelButton} disabled={deletingWebsite} onClick={cancelWebsiteDeletion} type="button">Keep website</button><button className={styles.deleteButton} disabled={!websiteMatches || deletingWebsite} onClick={deleteWebsite} type="button">{deletingWebsite ? "Deleting website…" : "Permanently delete website"}</button></div>
      </div> : null}
    </section>

    <section className={`${styles.card} ${styles.danger}`}>
      <div className={styles.heading}><span>Danger zone</span><h2>Delete account</h2><p>This permanently deletes your Destiny profile, websites, audits, plans, tracked keywords, and connections. This cannot be undone.</p></div>
      <label className={styles.confirmation}>Type <strong>{loginEmail}</strong> to confirm
        <input autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} placeholder={loginEmail} spellCheck={false} value={confirmation} />
      </label>
      {error && <p aria-live="polite" className={styles.error}>{error}</p>}
      <button className={styles.deleteButton} disabled={!matches || deleting} onClick={deleteAccount} type="button">{deleting ? "Deleting account…" : "Delete account"}</button>
    </section>
  </div>;
}
