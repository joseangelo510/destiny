"use client";

import { useState } from "react";
import styles from "./account-settings.module.css";
import {
  DEFAULT_RANKING_DIGEST_FREQUENCY,
  RANKING_DIGEST_FREQUENCIES,
  RECOMMENDED_RANKING_DIGEST_FREQUENCY,
  effectiveRankingDigestFrequency,
  lastRankingDigestSummary,
  rankingDigestFrequencyLabel,
  type RankingDigestFrequency,
  type RankingDigestSendStatus,
} from "../lib/notifications/ranking-digest";

type AccountWebsite = {
  id: string;
  businessName: string | null;
  normalizedDomain: string;
};

export type RankingEmailPreference = {
  frequency: RankingDigestFrequency;
  unsubscribedAt: string | null;
  lastDigestSentAt: string | null;
  lastDigestStatus: RankingDigestSendStatus;
};

export function AccountSettings({ activeWebsiteId = null, loginEmail, notificationEmail, websites = [], rankingEmailPreferences = {} }: {
  activeWebsiteId?: string | null;
  loginEmail: string;
  notificationEmail: string | null;
  websites?: AccountWebsite[];
  rankingEmailPreferences?: Record<string, RankingEmailPreference>;
}) {
  const [rankingChoices, setRankingChoices] = useState<Record<string, RankingDigestFrequency>>(() =>
    Object.fromEntries(websites.map((website) => {
      const preference = rankingEmailPreferences[website.id] ?? null;
      return [website.id, preference ? effectiveRankingDigestFrequency(preference) : DEFAULT_RANKING_DIGEST_FREQUENCY];
    })));
  const [savingRankingWebsiteId, setSavingRankingWebsiteId] = useState<string | null>(null);
  const [rankingMessages, setRankingMessages] = useState<Record<string, string>>({});

  async function saveRankingFrequency(websiteId: string, frequency: RankingDigestFrequency) {
    if (savingRankingWebsiteId) return;
    const previous = rankingChoices[websiteId];
    if (previous === frequency) return;
    setSavingRankingWebsiteId(websiteId);
    setRankingChoices((choices) => ({ ...choices, [websiteId]: frequency }));
    setRankingMessages((messages) => ({ ...messages, [websiteId]: "" }));
    try {
      const response = await fetch("/api/account/ranking-emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, frequency }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; frequency?: RankingDigestFrequency };
      if (!response.ok || !result.frequency) throw new Error(result.error || "Destiny could not save this ranking email setting.");
      setRankingChoices((choices) => ({ ...choices, [websiteId]: result.frequency as RankingDigestFrequency }));
      setRankingMessages((messages) => ({ ...messages, [websiteId]: "Ranking email setting saved." }));
    } catch (cause) {
      setRankingChoices((choices) => ({ ...choices, [websiteId]: previous }));
      setRankingMessages((messages) => ({ ...messages, [websiteId]: cause instanceof Error ? cause.message : "Destiny could not save this ranking email setting." }));
    } finally {
      setSavingRankingWebsiteId(null);
    }
  }
  const [savedNotificationEmail, setSavedNotificationEmail] = useState(notificationEmail ?? "");
  const [notificationDraft, setNotificationDraft] = useState(notificationEmail ?? "");
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
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

    <section className={styles.card}>
      <div className={styles.heading}><span>Keyword ranking emails</span><h2>Keyword ranking emails</h2><p>Choose how often each website emails you a ranking update. Every 3 days is recommended so movement is caught early.</p></div>
      {websites.length ? <div className={styles.websiteList}>
        {websites.map((website) => {
          const preference = rankingEmailPreferences[website.id] ?? null;
          const choice = rankingChoices[website.id] ?? DEFAULT_RANKING_DIGEST_FREQUENCY;
          const message = rankingMessages[website.id] ?? "";
          return <div className={styles.websiteRow} key={`ranking-${website.id}`}>
            <div className={styles.websiteIdentity}>
              <div className={styles.websiteTitleLine}><strong>{website.businessName?.trim() || website.normalizedDomain}</strong>{website.id === activeWebsiteId ? <span className={styles.currentBadge}>Current website</span> : null}</div>
              <span>{website.normalizedDomain}</span>
              <small className={styles.lastSent}>{lastRankingDigestSummary({ lastStatus: preference?.lastDigestStatus ?? "never", lastSentAt: preference?.lastDigestSentAt ?? null })}</small>
            </div>
            <fieldset className={styles.frequencyGroup} disabled={savingRankingWebsiteId === website.id}>
              <legend className={styles.visuallyHidden}>Ranking email frequency for {website.normalizedDomain}</legend>
              {RANKING_DIGEST_FREQUENCIES.map((frequency) => <label className={styles.frequencyOption} key={frequency}>
                <input checked={choice === frequency} name={`ranking-frequency-${website.id}`} onChange={() => void saveRankingFrequency(website.id, frequency)} type="radio" value={frequency} />
                <span>{rankingDigestFrequencyLabel(frequency)}{frequency === RECOMMENDED_RANKING_DIGEST_FREQUENCY ? <em className={styles.recommendedBadge}>Recommended</em> : null}</span>
              </label>)}
            </fieldset>
            {message && <p aria-live="polite" className={message.endsWith("saved.") ? styles.success : styles.error}>{message}</p>}
          </div>;
        })}
      </div> : <p className={styles.emptyWebsites}>Add a website to control its ranking emails.</p>}
      <p className={styles.websiteSafety}>Every ranking email includes a one-click unsubscribe link. Only fresh ranking readings are ever emailed.</p>
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
