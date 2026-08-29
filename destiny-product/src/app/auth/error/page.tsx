export default function AuthErrorPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand"><span className="brand-mark">D</span><span>Rebound SEO</span></div>
        <div className="eyebrow">Sign-in link expired</div>
        <h1>Let’s send a fresh one.</h1>
        <p>For your security, Rebound SEO’s email links can only be used once.</p>
        <a className="primary-button login-link" href="/login">Return to sign in</a>
      </section>
    </main>
  );
}

