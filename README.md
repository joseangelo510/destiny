# Destiny

Destiny turns SEO into one clear, compounding weekly habit. This repository is
the clean-slate, customer-facing web foundation. It is separate from the Google
AI Studio hackathon prototype.

## What works now

- Responsive audit-complete dashboard, designed to make the first action clear.
- Business onboarding with first/last name, email, website, business, ideal
  customer, competitors, and differentiation fields.
- Chrome speech recognition controls for the four long-form onboarding answers.
- A real LOGICAFFEINE/LOGOS rules engine compiled to WebAssembly.
- Browser and Supabase Edge Worker WebAssembly integration. Both runtimes must
  return the same growth stage and weekly quest before the UI accepts a result.
- An authenticated Supabase background audit worker. It saves an audit ID and
  returns immediately, then uses `EdgeRuntime.waitUntil` to finish independently
  of the browser. It runs a deterministic labeled demo audit until DataForSEO
  secrets exist, then switches to live paid endpoints.
- Supabase email magic-link authentication with protected app and API routes.
- Persistent onboarding through organization-scoped tables and RLS policies.
- Transactional audit persistence, saved result URLs, first weekly quests, and
  an in-app notification center.
- A database-hydrated homepage: refreshing after an audit keeps the saved
  metrics, website, profile, and LOGOS recommendation instead of resetting to
  seeded demo content.
- Quest completion and reopening with real completed-task, earned-XP, and
  consecutive-week streak calculations.
- Deployed welcome-email and audit-ready-email workers. They remain safely
  disabled until Resend and public-site secrets are configured.
- Generated TypeScript database types from the connected Supabase project.
- Desktop and mobile layouts.
- Secure Google OAuth connection infrastructure for Search Console, Analytics,
  Business Profile, and YouTube. OAuth state is single-use and credentials are
  encrypted with Supabase Vault.
- Read-only Google synchronization for Search Console queries and performance,
  GA4 organic sessions and key events, Business Profile locations and reviews,
  and YouTube channel and 28-day discovery performance. Synced snapshots appear
  in the Connections, Analytics, and Reviews screens.
- Automated coverage for URL safety, provider parsing, deterministic demo data,
  email behavior, and browser/worker LOGOS parity.

The default dashboard and unconfigured worker use demonstration data. The UI
labels that source directly. Live DataForSEO results turn on only when its two
Supabase Edge Function secrets are present. Google account data appears only
after a customer authorizes and explicitly syncs a connection.

## Architecture

```text
Customer browser
  -> Next.js Destiny experience
  -> Supabase passwordless authentication
  -> authenticated audit and notification routes

Supabase
  -> Postgres: organizations, websites, audits, metrics, quests, notifications
  -> RLS: organization and user isolation
  -> Edge Functions: DataForSEO orchestration + LOGOS WebAssembly
  -> Edge Functions: welcome and audit-ready transactional email

Configured integration layer
  -> Google OAuth: Search Console, GA4, Business Profile, YouTube
  -> Stripe: subscriptions after the core audit workflow is production-ready
```

LOGICAFFEINE is not the web host, database, OAuth provider, or background-job
system. It is used only for deterministic, inspectable Destiny business rules.

## Run locally

The repository uses Node.js 20+, pnpm, and Next.js.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Regenerate the LOGOS WebAssembly module

The LOGOS source is in the sibling directory `../destiny-logic-engine`.

```bash
cd ../destiny-logic-engine
../.tools/logicaffeine/largo check
../.tools/logicaffeine/largo run --interpret -- 1 3 7 8 6
../.tools/logicaffeine/largo emit wasm
cp target/destiny-logic-engine.wasm ../destiny-product/public/logic/
```

Expected rules-engine output for the example above:

```text
fix_foundations
Fix the highest-impact technical issue
```

## Production configuration

Copy `.env.example` to `.env.local` only when the corresponding accounts have
been created. Never commit real keys, Google tokens, or customer data.

The Next.js host uses only a browser-safe Supabase publishable key. The Supabase
service-role/secret key is not present in this repository. All app and API routes
except `/login` and `/auth/*` require a verified Supabase session. Audit worker
RPCs are explicitly unavailable to `anon` and `authenticated`; only the
Supabase service role can execute them.

No DataForSEO secret means deterministic demo mode and no paid calls. Add
`DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` to **Supabase Edge Function
Secrets** to enable live audits. One live audit calls Instant Pages, Ranked
Keywords, Competitors Domain, Keywords for Site, and, when a competitor exists,
Domain Intersection. These are paid provider calls. The editorial calendar
interleaves existing rankings, competitor gaps, and relevant site ideas into up
to 24 weekly topics. Credentials stay in Supabase and are never returned to the
browser.

Add `RESEND_API_KEY`, `DESTINY_FROM_EMAIL`, and `DESTINY_SITE_URL` to Supabase
Edge Function Secrets to activate welcome and audit-ready emails. The sender
must be a verified Resend sender. `DESTINY_SITE_URL` must be the public HTTPS
origin so audit emails contain a working saved-results link.

To activate Google connections, create a Google OAuth web client and add
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `DESTINY_SITE_URL` to Supabase
Edge Function Secrets. Register this exact authorized redirect URI in Google
Cloud:

```text
https://etkksjebqgtkkdqznnxa.supabase.co/functions/v1/google-oauth-callback
```

Configure the consent screen for the Search Console read-only, Analytics
read-only, Business Profile, YouTube read-only, and YouTube Analytics read-only
scopes. During testing, add each tester to the consent screen. Access and
refresh tokens are stored in Supabase Vault; the browser receives only a
success or failure redirect.

Enable these Google Cloud APIs in the OAuth client's project before testing:

- Google Search Console API
- Google Analytics Admin API and Google Analytics Data API
- My Business Account Management API, My Business Business Information API,
  and Google My Business API
- YouTube Data API v3 and YouTube Analytics API

After a product is connected, use **Sync now** on the Connections screen. The
sync is read-only. It selects the matching Search Console property or Business
Profile website when possible; the current MVP uses the first accessible GA4
property when more than one is available and displays the selected resource.

## Replit publishing handoff

The included `.replit` file runs Next.js on `0.0.0.0:3000` and supplies build
and production-start commands. Use an **Autoscale** publication because Destiny
has server-rendered routes and authenticated APIs; it is not a static site.

Add these production secrets in Replit's Publishing pane (editor secrets do not
automatically carry into the published app):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Keep DataForSEO and Resend secrets in Supabase rather than duplicating them in
Replit. After publishing, set `NEXT_PUBLIC_SITE_URL` and Supabase's
`DESTINY_SITE_URL` to the final HTTPS URL, then add that URL to Supabase Auth's
allowed redirect URLs.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
```

The browser test should cover:

1. Anonymous visitors redirect to `/login`.
2. A magic link creates a verified session and profile.
3. The audit-complete dashboard renders.
4. `Audit a new website` opens onboarding.
5. Required onboarding fields validate and persist to Supabase.
6. `Start my audit` invokes the authenticated Edge worker and persists an audit.
7. The processing page survives refreshes, polls the saved audit, and handles a
   persisted worker failure without showing fake results.
8. Browser and worker LOGOS results match before the dashboard updates.
9. The notification center links to `/audits/<audit-id>`.
10. The saved results page shows the provider label, metrics, findings,
   competitors, keyword preview, and first weekly quest.
11. Completing a quest persists its completion date, XP, task count, and weekly
    streak; reopening it removes that completion.
12. Refreshing `/` retains the latest saved audit instead of restoring the
    seeded dashboard.
13. No browser console errors appear.
14. Each authorized Google connection can be synced and its saved, source-
    labeled snapshot appears on Analytics or Reviews without exposing tokens.
