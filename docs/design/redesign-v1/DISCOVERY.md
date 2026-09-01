# Rebound SEO redesign v1 — Gate 0 discovery

Status: `SLICE_1_GO_D10_0`

Date: 2026-08-31

## Answer first

Fable 5 High decision D10.0 authorizes Foundation plus the read-only Home page on a new, unlinked, authenticated `/app/home` route. The slice is MEDIUM after the recorded HIGH governance re-pin. No feature flag, allowlist, schema, secret, runtime configuration, authentication, session, RLS, CI/deploy, cutover, release tag, write action, existing route, or existing tool change is permitted.

The current repository already contains the authenticated workspace resolution and most of the read-only data needed for Home. Missing data must render an honest empty, error, or not-connected state. The product must not render the pottery examples from the design files.

## Canonical source and decision

- Repository: `joseangelo510/destiny`.
- Slice base and governing policy SHA: `14cbda0e36fe217892cdfd1e4946c036edfb1e55`.
- `HARNESS_POLICY.md` SHA-256: `fd2fde61e20d2946c8cd793e82daeeaf5e9be93235b31b41bf79c384da03b34c`.
- Prior pin `24c0ee825df6ca9359a4dfadf25779b15cef7ece`: unreachable from canonical refs and void under D10.0.
- Branch: `codex/rebound-redesign-v1-slice-1`.
- Decision: D10.0 in `destiny-product/DEPLOY_LOG.md`.

## Verbatim policy classification

The MEDIUM clauses in `HARNESS_POLICY.md` at the governing SHA are:

> Fable Medium is sufficient when the change stays outside every HIGH and frozen surface:
>
> - UI, UX, styling, copy, and accessibility;
> - ordinary application features;
> - refactors that preserve behavior and keep all gates green;
> - test additions and non-governance documentation;
> - dependency patch or minor updates that do not touch authentication, cryptography, payments, sessions, or Supabase access;
> - staging verification through the existing pipeline;
> - redeploying a prior immutable tag to staging.

The HIGH clauses in `HARNESS_POLICY.md` at the governing SHA are:

> Fable High must decide and the decision must be recorded in `destiny-product/DEPLOY_LOG.md` before work begins for:
>
> - this policy or any enforcement workflow, script, agent pointer, or governance skill;
> - authentication, OAuth, session, RLS, authorization, or security-model changes;
> - database schema changes or migrations;
> - secrets, environment variables, runtime configuration, or provider credentials;
> - dependency major updates, new runtime dependencies, removals, or authentication, cryptography, payment, session, and Supabase dependency changes;
> - production or parallel-launch cutovers, deploys, and rollbacks;
> - release tags;
> - CI or deployment workflow changes;
> - any frozen action below;
> - any ambiguous change. Ambiguity defaults to HIGH.

These clauses match the Gate 0 summary. D10.0 is therefore active.

## Stack, routing, authentication, and workspace scope

- Next.js `16.2.12`, React `19.2.4`, TypeScript, App Router, Supabase SSR, pnpm `11.9.0`, Node `22+`.
- Existing `/app` remains unchanged and redirects an authenticated, onboarded workspace to `/this-week`.
- The new route is additive at `src/app/app/home/page.tsx`, which resolves to `/app/home` without touching middleware, proxy matchers, auth, route-group configuration, or existing routes.
- `getWorkspaceContext()` calls `requireWorkspaceClient()`. That existing path obtains authenticated Supabase claims and redirects an unauthenticated request to `/login`.
- `getWorkspaceContext()` also resolves the active website from the existing cookie and scopes all downstream queries by `website.id`.
- The new route uses those functions unchanged. No new auth or workspace mechanism is introduced.

## Existing data coverage

| Home surface | Existing source | Slice 1 behavior |
|---|---|---|
| Greeting and workspace | profile and selected website | Real first name/business; no synthetic last-visit claim |
| Session and ranked queue | `quests` and existing coach ordering | One shared ranked list feeds session move 1 and queue item 1 |
| Search Console | connected integration metadata and existing analytics parser | Real totals/series or not-connected state |
| Analytics | current GA4 integration state | Honest connected summary when present; otherwise not-connected; no connect write |
| Keywords | `tracked_keywords` and `rank_observations` | Real counts, buckets, and movers or empty state |
| Competitors | `competitors` names and URLs | Real names only; unsupported visibility and publishing claims omitted |
| Month | active `publishing_plans` and `publishing_schedule_items` | Real persisted schedule or empty state |
| Existing tools | `FEATURE_NAVIGATION` | Linked from the new shell without changing tool routes |

## Missing or partial data

- No product feature flag or allowlist exists. D10.0 permits no new flag for Slice 1 and requires `/app/*` to remain unlinked from all existing pages.
- Cloudflare Analytics is absent and must not be offered as a working provider.
- No unified distribution touchpoint/event ledger exists.
- No durable per-user `last_seen_at` exists, so Home makes no “since your last visit” claim.
- Competitor visibility, publishing pace, and weekly crawl intelligence are not consistently persisted, so Slice 1 does not invent them.
- Cadence and milestone persistence are not in Slice 1.

## Locked design and invariants

- Home follows `rebound-notes-v5.html`; the new shell follows `rebound-five-pillars.html`.
- Panel order is session/queue with performance, then Keywords, Competitors, and The month.
- Queue item 1 and session move 1 are the same object from the same ranked array.
- `verified_live` can only be derived from persisted CMS/crawler/GSC evidence. User-reported input cannot construct it.
- Lime is reserved for verified evidence and one primary action per view.
- Customer-facing copy says “Rebound SEO,” never “Destiny.”
- Existing tools are linked under Tools and remain unchanged.
- The new shell contains one dismissible `Preview — read-only` strip.
- Missing data preserves panel layout and renders an honest state.

## Stop conditions

Stop if `/app/home` requires an auth, matcher, session, route-group, schema, secret, environment, runtime-config, dependency, CI/deploy, existing-route, existing-tool, or integration-fetch change; if any query could cross workspace boundaries; if Home requires altering the approved layout; if any existing test, lint, typecheck, or build check fails; if the policy content changes; or if scope becomes ambiguous.

## Claim boundary

This slice can be called complete only after its protected PR is merged with the required green check URLs and merge SHA. It is not a cutover, release, production availability claim, write workflow, or user-facing announcement. Slice 2 does not start until Fable 5 High returns GO after the Slice 1 check-in.
