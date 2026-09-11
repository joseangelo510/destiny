"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMagicLink } from "./actions";

function SubmitButton({ remaining, resend }: { remaining: number; resend: boolean }) {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending || remaining > 0} aria-busy={pending}>
    {pending ? "Sending your link…" : remaining > 0 ? `Try again in ${remaining}s` : resend ? "Send another sign-in link" : "Email me a sign-in link"}
  </button>;
}

export function LoginForm({ email = "", next, error, cooldown = 0, resend = false }: {
  email?: string; next: string; error?: string; cooldown?: number; resend?: boolean;
}) {
  const [remaining, setRemaining] = useState(cooldown);
  useEffect(() => {
    const deadline = Date.now() + cooldown * 1000;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  return <form action={sendMagicLink}>
    <input name="next" type="hidden" value={next} />
    {resend ? <input name="email" type="hidden" value={email} /> : <label>Email address<input autoComplete="email" name="email" required type="email" defaultValue={email} /></label>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <SubmitButton remaining={remaining} resend={resend} />
    <p role="status">{remaining > 0 ? "Please wait before requesting another link." : cooldown > 0 ? "You can request another link now." : ""}</p>
  </form>;
}
