"use client";

import { useState } from "react";
import styles from "./account-settings.module.css";

export function AccountSettings({ loginEmail, notificationEmail }: { loginEmail: string; notificationEmail: string | null }) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const matches = confirmation.trim().toLowerCase() === loginEmail.toLowerCase();

  async function deleteAccount() {
    if (!matches || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
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
        <div><dt>Audit and contact email</dt><dd>{notificationEmail || "Not set"}</dd><p>Welcome messages and audit-ready links go here. A new website starts with your login email, but you can change it during onboarding.</p></div>
      </dl>
    </section>
    <section className={`${styles.card} ${styles.danger}`}>
      <div className={styles.heading}><span>Danger zone</span><h2>Delete account</h2><p>This permanently deletes your Destiny profile, websites, audits, plans, tracked keywords, and connections. This cannot be undone.</p></div>
      <label className={styles.confirmation}>Type <strong>{loginEmail}</strong> to confirm<input autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} placeholder={loginEmail} spellCheck={false} value={confirmation} /></label>
      {error && <p aria-live="polite" className={styles.error}>{error}</p>}
      <button className={styles.deleteButton} disabled={!matches || deleting} onClick={deleteAccount} type="button">{deleting ? "Deleting account…" : "Delete account"}</button>
    </section>
  </div>;
}
