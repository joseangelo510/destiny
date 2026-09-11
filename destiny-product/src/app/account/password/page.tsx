import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/auth/redirect";
import { PasswordForm } from "@/app/login/password-form";

export const metadata = { title: "Set your password — Rebound SEO" };
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; saved?: string }> }) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/login?${new URLSearchParams({ mode: "reset", next })}`);
  return <main className="login-shell"><section className="login-card">
    <Link className="brand login-brand" href={next}><span className="brand-mark">R</span><span>Rebound SEO</span></Link>
    <div className="eyebrow">Your account, your way in</div>
    <h1>Make your next login easier.</h1>
    <p>Set a password for <strong>{data.user.email}</strong>. Your websites and saved work stay in this account.</p>
    {params.saved === "1" ? <><p role="status">Password saved. Next time, use your email and password to log in.</p><Link className="primary-button login-link" href={next}>Return to your workspace</Link></>
      : <PasswordForm mode="set" next={next} error={params.error} />}
    <Link className="secondary-button login-link" href={next}>Back to workspace</Link>
  </section></main>;
}
