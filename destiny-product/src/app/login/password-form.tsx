"use client";

import "./password.css";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset, savePassword, signInWithPassword, signUpWithPassword } from "./password-actions";

type Mode = "password" | "signup" | "reset" | "set";
function Submit({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const label = { password: "Log in", signup: "Create account", reset: "Send password recovery email", set: "Save password" }[mode];
  return <button className="primary-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Please wait…" : label}</button>;
}
export function PasswordForm({ mode, email = "", next, error }: { mode: Mode; email?: string; next: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const isNew = mode === "signup" || mode === "set";
  const action = { password: signInWithPassword, signup: signUpWithPassword, reset: requestPasswordReset, set: savePassword }[mode];
  return <form action={action}>
    <input name="next" type="hidden" value={next} />
    {mode !== "set" && <label>Email address<input name="email" type="email" autoComplete="email" defaultValue={email} required /></label>}
    {mode !== "reset" && <>
      <label>{isNew ? "New password" : "Password"}<input name="password" type={visible ? "text" : "password"} autoComplete={isNew ? "new-password" : "current-password"} minLength={isNew ? 12 : undefined} maxLength={isNew ? 128 : 1024} required /></label>
      {isNew && <><p className="password-help">Use 12–128 characters. A unique passphrase works well.</p><label>Confirm password<input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required /></label></>}
      <button className="password-visibility" type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? "Hide password" : "Show password"}</button>
    </>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <Submit mode={mode} />
  </form>;
}
