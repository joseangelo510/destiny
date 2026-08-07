"use client";

import { useState } from "react";
import styles from "./account-settings.module.css";

export function AccountSettings({ loginEmail, notificationEmail }: { loginEmail: string; notificationEmail: string | null }) {
  const [savedNotificationEmail, setSavedNotificationEmail] = useState(notificationEmail ?? "");
  const [notificationDraft, setNotificationDraft] = useState(notificationEmail ?? "");
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const matches = confirmation.trim().toLowerCase() === loginEmail.toLowerCase();
  const normalizedNotificationDraft = notificationDraft.trim().toLowerCase();
  const notificationEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNotificationDraft);
  const notificationEmailChanged = normalizedNotificationDraft !== savedNotificationEmail.toLowerCase();

  async function saveNotificationEmail() {
    if (!notificationEmailValid || !notificationEmailChanged || savingNotificationEmail) return;
    setSavingNotificationEmail(true);
    setNotificationMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: normalizedNotificationDraft }),
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
        <div><dt>Audit and contact email</dt><dd>{savedNotificationEmail || "Not set"}</dd><p>Welcome messages and audit-ready links go here. Update it here whenever those reports should go somewhere else.</p><label className={styles.emailEditor}><span>Notification email</span><input aria-label="Audit and contact email" autoComplete="email" onChange={(event) => { setNotificationDraft(event.target.value); setNotificationMessage(""); }} type="email" value={notificationDraft} /></label><button className={styles.saveButton} disabled={!notificationEmailValid || !notificationEmailChanged || savingNotificationEmail} onClick={() => void saveNotificationEmail()} type="button">{savingNotificationEmail ? "Saving…" : "Save notification email"}</button>{notificationMessage && <p aria-live="polite" className={notificationMessage.endsWith("saved.") ? styles.success : styles.error}>{notificationMessage}</p>}</div>
      </dl>
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
