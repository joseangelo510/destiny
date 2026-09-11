import Link from "next/link";
import { LoginForm } from "./login-form";
import { safeInternalPath } from "@/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<{ email?: string; error?: string; next?: string; sent?: string; retry?: string; attempt?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);
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
            <p>Check your spam folder too. Use the most recent link; you do not need to start onboarding again for an existing workspace.</p>
            <LoginForm key={`sent:${params.email}:${params.attempt}`} email={params.email} next={next} cooldown={60} resend />
            <a className="secondary-button login-link" href={`/login?${new URLSearchParams({ next })}`}>Use another email</a>
          </>
        ) : (
          <>
            <div className="eyebrow">Log in to Rebound SEO</div>
            <h1>Your next chapter starts here.</h1>
            <p>Enter your email. No password required—we’ll send you a secure sign-in link.</p>
            <p>Use the email connected to your existing workspace. A different email opens a separate account.</p>
            <LoginForm key={`${params.email}:${params.error}:${retry}:${params.attempt}`} email={params.email} next={next} error={params.error} cooldown={retry} />
          </>
        )}
      </section>
    </main>
  );
}
