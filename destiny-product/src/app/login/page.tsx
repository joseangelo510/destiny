import Link from "next/link";
import { LoginForm } from "./login-form";
import { PasswordForm } from "./password-form";
import { safeInternalPath } from "@/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<{ email?: string; error?: string; next?: string; sent?: string; mode?: string; notice?: string; retry?: string; attempt?: string }>;
};

export const metadata = { title: "Log in — Rebound SEO" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);
  const mode = params.mode === "signup" || params.mode === "reset" || params.mode === "link" ? params.mode : "password";
  const href = (choice: string, email = params.email ?? "") => `/login?${new URLSearchParams({ mode: choice, next, email })}`;
  const retry = Math.min(3600, Math.max(0, Number(params.retry) || 0));
  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="brand login-brand" href="/"><span className="brand-mark">R</span><span>Rebound SEO</span></Link>
        {params.sent === "1" ? (
          <>
            <div className="eyebrow">Check your inbox</div>
            <h1>Your next chapter is waiting.</h1>
            <p>We sent a secure sign-in link to <strong>{params.email}</strong>. Open it in this browser to continue.</p>
            <p>Check your spam folder too. Use the most recent link in this browser. After signing in, set a password in Account to skip email links next time.</p>
            <LoginForm key={`sent:${params.email}:${params.attempt}`} email={params.email} next={next} cooldown={60} resend />
            <a className="secondary-button login-link" href={href("password")}>Log in with password</a>
            <a className="password-nav" href={href("link", "")}>Use another email</a>
          </>
        ) : (
          <>
            <div className="eyebrow">Log in to Rebound SEO</div>
            <h1>{mode === "signup" ? "Your comeback starts here." : mode === "reset" ? "One reset. Easier logins." : "Your next chapter starts here."}</h1>
            <p>{mode === "signup" ? "Create your account with an email and password. Confirm your email once; then log in with your password." : mode === "reset" ? "Already used a sign-in link? Set a password for that same account. We’ll send one recovery email to get you started." : mode === "link" ? "Prefer an email link? Request one below. You can choose password login anytime." : "Log in with your email and password. Gmail, Yahoo, or your business email all work here."}</p>
            {params.notice === "confirm" && <p role="status">Check your inbox and spam folder for a confirmation email if this address is new. Already have an account? Log in or set your password below.</p>}
            {params.notice === "recovery" && <p role="status">If an account exists for {params.email}, a password recovery email has been requested. Check your inbox and spam folder, and open the latest link in this browser.</p>}
            {mode === "link" ? <LoginForm key={`${params.email}:${params.error}:${retry}:${params.attempt}`} email={params.email} next={next} error={params.error} cooldown={retry} />
              : <PasswordForm key={`${mode}:${params.email}:${params.error}`} mode={mode} email={params.email} next={next} error={params.error} />}
            <nav className="password-nav" aria-label="Sign-in options">
              {mode === "password" ? <><a href={href("reset")}>Set or reset password</a><a href={href("signup")}>Create an account</a><a href={href("link")}>Use an email link instead</a></>
                : <a href={href("password")}>Back to password login</a>}
            </nav>
            <p className="password-help">Use the email connected to your existing workspace. A different email opens a separate account.</p>
          </>
        )}
      </section>
    </main>
  );
}
