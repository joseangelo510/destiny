# Destiny total-coverage QA methodology

Case study: Smart & Fast Background Checks (`smartfastbackgroundchecks.com`)

Smart & Fast is the production evidence workspace, not a destructive test fixture. Production testing is read-only. Any test that changes Destiny data, spends API credits, triggers a crawl, sends an email, transfers content to a CMS, reconnects a provider, publishes, posts, or deletes must use a disposable staging workspace and disposable integrations.

## Definition of done

A screen loading is not a pass. A test passes only when the expected behavior is observed, evidence is saved, the selected website is proven in the backing request or stored row, the operation occurs exactly once, and any required cleanup completes. Results use `PASS`, `FAIL`, `BLOCKED`, or `WAIVED`; unexecuted tests remain `NOT RUN`.

## Omission-proof inventory

Destiny reconciles four inventories:

1. Next.js pages, API routes, dynamic segments, and server actions.
2. Source-level controls, handlers, forms, inputs, and data mutations.
3. Runtime DOM controls for every route and meaningful UI state.
4. Supabase tables/policies/functions/storage plus external providers.

`pnpm qa:inventory` creates the route list, static-control list, and coverage ledger in `qa/inventory`. Every discovered control receives a stable source-based ID and a matrix row. New controls therefore cannot disappear into an informal checklist.

## Side-effect classes

- Class 0: read-only views, filters, tabs, sorting, downloads that do not create server records, and link checks. Allowed against Smart & Fast production.
- Class 1: reversible Destiny state such as approving a keyword, editing a draft, or moving a tracked keyword. Staging by default.
- Class 2: external or costly work such as audits, LLM generation, email, provider sync, and CMS draft delivery. Disposable staging only.
- Class 3: public or destructive work such as publishing, posting, contacting people, requesting customer reviews, disconnecting integrations, or deleting a website/account. Never against Smart & Fast production.

The production Playwright project installs a request guard that blocks Destiny API and Supabase mutations. A blocked attempt fails the test.

## Golden journeys

1. Auth request, magic-link consumption, workspace restoration, and sign out.
2. Audit list and saved audit detail with database-count reconciliation.
3. Recommended, approved, and declined keyword flow; approval creates the intended tracker/content decision exactly once.
4. Content brief, complete generation, edit persistence, review gate, Word export, re-optimization, and CMS draft-only delivery.
5. Rank Tracker positions, dates, lists, and approved-keyword provenance.
6. Distribution, reviews, creator suggestions, directories, and live-link validity without sending externally.
7. GSC/GA4/Business Profile/YouTube connection health and one provider-to-UI metric reconciliation.
8. This Week, Roadmap, Game Plan, and Analytics coherence.
9. LLM visibility evidence with no fabricated citations.
10. Welcome and audit-completion emails captured in staging with correct tenant content.
11. Disposable account creation and deletion cascade.
12. Direct cross-tenant RLS/API/IDOR/storage denial for every site-keyed surface.

## Required negative coverage

Every data surface needs empty, loading, partial, stale-token, provider-failure, rate-limit, retry, offline/recovery, and double-click tests. Core flows run at 375x812, 768x1024, and 1440x900. Serious/critical accessibility violations fail the gate. Voice dictation covers grant, deny, silence-stop, and permission revoked mid-session. Time-based features cover Sunday/Monday and timezone boundaries.

## Release gate

`pnpm gate` regenerates the inventory, lints, runs Vitest, builds, and runs browser tests. Production-only authenticated tests require an explicit `QA_AUTH_STATE` file and `QA_PROD_READONLY=1`; without it they report skipped rather than creating a false pass. State-changing staging coverage remains blocked until a disposable staging deployment and test identities exist.

## Severity

- S0: cross-tenant exposure, auth bypass, secret leakage, or any unapproved external write.
- S1: broken golden path, data loss, double-spend, review-gate bypass, or incorrect destructive behavior.
- S2: broken feature with a workaround, wrong non-leaking data, or serious accessibility failure on a core flow.
- S3: cosmetic or non-core usability defect.

## Current execution boundary

The live Smart & Fast route census is safe to run now. Keyword approvals, article generation, sync, emails, CMS delivery, integration reconnects, website/account deletion, and public posting are intentionally not tested in production. They require the disposable staging environment described above.
