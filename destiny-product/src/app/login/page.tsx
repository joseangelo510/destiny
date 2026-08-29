import Link from "next/link";
import { sendMagicLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ email?: string; error?: string; next?: string; sent?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="brand login-brand" href="/"><span className="brand-mark">R</span><span>Rebound SEO</span></Link>
        {params.sent === "1" ? (
          <>
            <div className="eyebrow">Check your inbox</div>
            <h1>Your path is waiting.</h1>
            <p>We sent a secure sign-in link to <strong>{params.email}</strong>. Open it in this browser to continue.</p>
            <a className="secondary-button login-link" href="/login">Use another email</a>
          </>
        ) : (
          <>
            <div className="eyebrow">Welcome to Rebound SEO</div>
            <h1>Make SEO a habit that compounds.</h1>
            <p>Enter your email. No password required—we’ll send you a secure sign-in link.</p>
            <form action={sendMagicLink}>
              <input name="next" type="hidden" value={params.next ?? "/app"} />
              <label>Email address<input autoComplete="email" name="email" required type="email" /></label>
              {params.error && <div className="error-banner">{params.error}</div>}
              <button className="primary-button" type="submit">Email me a sign-in link</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
