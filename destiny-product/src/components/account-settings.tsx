"use client";

import { useState } from "react";
import { formatUtcDate } from "@/lib/format-date";
import styles from "./account-settings.module.css";

type AccountWebsite = {
  id: string;
  businessName: string | null;
  normalizedDomain: string;
  rankingDigestFrequency: "three_day" | "weekly" | "off";
  lastDigestSentAt: string | null;
  reportEmail: string;
  deliveryStatus: string | null;
  deliveryError: string | null;
};

export function AccountSettings({ activeWebsiteId = null, loginEmail, notificationEmail, websites = [] }: {
  activeWebsiteId?: string | null;
  loginEmail: string;
  notificationEmail: string | null;
  websites?: AccountWebsite[];
}) {
  const [savedNotificationEmail, setSavedNotificationEmail] = useState(notificationEmail ?? "");
  const [notificationDraft, setNotificationDraft] = useState(notificationEmail ?? "");
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [rankingDigestFrequencies, setRankingDigestFrequencies] = useState<Record<string, AccountWebsite["rankingDigestFrequency"]>>(
    Object.fromEntries(websites.map((website) => [website.id, website.rankingDigestFrequency])),
  );
  const [savingDigestWebsiteId, setSavingDigestWebsiteId] = useState<string | null>(null);
  const [digestMessage, setDigestMessage] = useState<Record<string, string>>({});
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
      if (!response.ok) throw new Error(result.error || "Rebound SEO could not delete this website.");
      window.location.assign(result.nextWebsiteId ? "/account" : "/onboarding");
    } catch (cause) {
      setWebsiteError(cause instanceof Error ? cause.message : "Rebound SEO could not delete this website.");
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
      if (!response.ok || !result.notificationEmail) throw new Error(result.error || "Rebound SEO could not save this email.");
      setSavedNotificationEmail(result.notificationEmail);
      setNotificationDraft(result.notificationEmail);
      setNotificationMessage("Audit and contact email saved.");
    } catch (cause) {
      setNotificationMessage(cause instanceof Error ? cause.message : "Rebound SEO could not save this email.");
    } finally {
      setSavingNotificationEmail(false);
    }
  }

  async function saveRankingDigestFrequency(websiteId: string, frequency: AccountWebsite["rankingDigestFrequency"]) {
    if (savingDigestWebsiteId) return;
    const previous = rankingDigestFrequencies[websiteId] ?? "weekly";
    setSavingDigestWebsiteId(websiteId);
    setRankingDigestFrequencies((current) => ({ ...current, [websiteId]: frequency }));
    setDigestMessage((current) => ({ ...current, [websiteId]: "" }));
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankingDigestFrequency: frequency, websiteId }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; rankingDigestFrequency?: AccountWebsite["rankingDigestFrequency"] };
      if (!response.ok || !result.rankingDigestFrequency) throw new Error(result.error || "Rebound SEO could not save this notification setting.");
      setRankingDigestFrequencies((current) => ({ ...current, [websiteId]: result.rankingDigestFrequency as AccountWebsite["rankingDigestFrequency"] }));
      setDigestMessage((current) => ({ ...current, [websiteId]: frequency === "off" ? "Ranking emails turned off." : "Ranking email schedule saved." }));
    } catch (cause) {
      setRankingDigestFrequencies((current) => ({ ...current, [websiteId]: previous }));
      setDigestMessage((current) => ({ ...current, [websiteId]: cause instanceof Error ? cause.message : "Rebound SEO could not save this notification setting." }));
    } finally {
      setSavingDigestWebsiteId(null);
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
      if (!response.ok) throw new Error(result.error || "Rebound SEO could not delete this account.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not delete this account.");
      setDeleting(false);
    }
  }

  return <div className={styles.stack}>
    <section className={styles.card}>
      <div className={styles.heading}><span>Identity</span><h2>Your Rebound SEO account</h2><p>These addresses can be different. One controls sign-in; the other receives website reports and updates.</p></div>
      <dl className={styles.identityList}>
        <div><dt>Login email</dt><dd>{loginEmail}</dd><p>This is the email connected to your authenticated Rebound SEO account.</p></div>
        <div><dt>Audit and contact email</dt><dd>{savedNotificationEmail || "Not set"}</dd><p>Welcome messages and audit-ready links for the current website go here. Each website can use a different address.</p><label className={styles.emailEditor}><span>Notification email</span><input aria-label="Audit and contact email" autoComplete="email" onChange={(event) => { setNotificationDraft(event.target.value); setNotificationMessage(""); }} type="email" value={notificationDraft} /></label><button className={styles.saveButton} disabled={!activeWebsiteId || !notificationEmailValid || !notificationEmailChanged || savingNotificationEmail} onClick={() => void saveNotificationEmail()} type="button">{savingNotificationEmail ? "Saving…" : "Save notification email"}</button>{notificationMessage && <p aria-live="polite" className={notificationMessage.endsWith("saved.") ? styles.success : styles.error}>{notificationMessage}</p>}</div>
      </dl>
    </section>

    <section className={styles.card}>
      <div className={styles.heading}><span>Email notifications</span><h2>Keyword ranking emails</h2><p>Choose how often Rebound SEO emails a short summary of which keywords moved up, moved down, and entered or left the top 10.</p></div>
      {websites.length ? <div className={styles.digestList}>
        {websites.map((website) => {
          const frequency = rankingDigestFrequencies[website.id] ?? website.rankingDigestFrequency;
          const message = digestMessage[website.id];
          const saving = savingDigestWebsiteId === website.id;
          return <div className={styles.digestRow} key={website.id}>
            <div className={styles.digestIdentity}><strong>{website.businessName?.trim() || website.normalizedDomain}</strong><span>{website.normalizedDomain}</span><small>Reports go to {website.reportEmail}</small>{website.lastDigestSentAt ? <small>Last provider attempt {formatUtcDate(website.lastDigestSentAt)} · {website.deliveryStatus === "delivered" ? "Delivered" : website.deliveryStatus === "failed" ? "Delivery failed" : "Accepted; delivery confirmation pending"}</small> : <small>Your first update will follow the next fresh ranking check.</small>}{website.deliveryError ? <small className={styles.error}>{website.deliveryError}</small> : null}</div>
            <div aria-label={`Ranking email frequency for ${website.normalizedDomain}`} className={styles.frequencyControl} role="group">
              <button aria-pressed={frequency === "three_day"} disabled={Boolean(savingDigestWebsiteId)} onClick={() => void saveRankingDigestFrequency(website.id, "three_day")} type="button"><span>Every 3 days</span></button>
              <button aria-pressed={frequency === "weekly"} disabled={Boolean(savingDigestWebsiteId)} onClick={() => void saveRankingDigestFrequency(website.id, "weekly")} type="button"><span>Weekly</span><small>Recommended</small></button>
              <button aria-pressed={frequency === "off"} disabled={Boolean(savingDigestWebsiteId)} onClick={() => void saveRankingDigestFrequency(website.id, "off")} type="button"><span>Off</span></button>
            </div>
            {saving ? <p aria-live="polite" className={styles.digestStatus}>Saving…</p> : message ? <p aria-live="polite" className={message.includes("saved") || message.includes("turned off") ? styles.success : styles.error}>{message}</p> : null}
          </div>;
        })}
      </div> : <p className={styles.emptyWebsites}>Add a website before choosing a ranking email schedule.</p>}
    </section>

    <section className={styles.card}>
      <div className={styles.heading}><span>Website management</span><h2>Your websites</h2><p>Review the websites connected to this login or remove one you no longer want Rebound SEO to manage.</p></div>
      {websites.length ? <div className={styles.websiteList}>
        {websites.map((website) => <div className={styles.websiteRow} key={website.id}>
          <div className={styles.websiteIdentity}>
            <div className={styles.websiteTitleLine}><strong>{website.businessName?.trim() || website.normalizedDomain}</strong>{website.id === activeWebsiteId ? <span className={styles.currentBadge}>Current website</span> : null}</div>
            <span>{website.normalizedDomain}</span>
          </div>
          <button className={styles.websiteDeleteButton} disabled={deletingWebsite} onClick={() => beginWebsiteDeletion(website)} type="button">Delete website</button>
        </div>)}
      </div> : <p className={styles.emptyWebsites}>No websites are connected to this account yet.</p>}
      <p className={styles.websiteSafety}>Deleting a website does not delete your Rebound SEO account or any of your other websites.</p>
      {pendingWebsite ? <div aria-label={`Confirm deletion of ${pendingWebsite.normalizedDomain}`} className={styles.websiteDeletePanel} role="group">
        <div><strong>Delete {pendingWebsite.normalizedDomain}?</strong><p>This permanently removes this website’s audits, keywords, three-month plans, tasks, rank tracking, drafts, reviews, and connections. This cannot be undone.</p></div>
        <label className={styles.confirmation}>Type <strong>{pendingWebsite.normalizedDomain}</strong> to confirm<input autoComplete="off" autoFocus onChange={(event) => setWebsiteConfirmation(event.target.value)} placeholder={pendingWebsite.normalizedDomain} spellCheck={false} value={websiteConfirmation} /></label>
        {websiteError && <p aria-live="polite" className={styles.error}>{websiteError}</p>}
        <div className={styles.websiteDeleteActions}><button className={styles.cancelButton} disabled={deletingWebsite} onClick={cancelWebsiteDeletion} type="button">Keep website</button><button className={styles.deleteButton} disabled={!websiteMatches || deletingWebsite} onClick={deleteWebsite} type="button">{deletingWebsite ? "Deleting website…" : "Permanently delete website"}</button></div>
      </div> : null}
    </section>

    <section className={`${styles.card} ${styles.danger}`}>
      <div className={styles.heading}><span>Danger zone</span><h2>Delete account</h2><p>This permanently deletes your Rebound SEO profile, websites, audits, plans, tracked keywords, and connections. This cannot be undone.</p></div>
      <label className={styles.confirmation}>Type <strong>{loginEmail}</strong> to confirm
        <input autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} placeholder={loginEmail} spellCheck={false} value={confirmation} />
      </label>
      {error && <p aria-live="polite" className={styles.error}>{error}</p>}
      <button className={styles.deleteButton} disabled={!matches || deleting} onClick={deleteAccount} type="button">{deleting ? "Deleting account…" : "Delete account"}</button>
    </section>
  </div>;
}
