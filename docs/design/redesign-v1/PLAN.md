# Rebound SEO — Redesign v1: Implementation Plan & Methodology

**Document type:** Fable 5 High advisory plan (MEDIUM). This document does **not** authorize any frozen action. Every item marked HIGH below requires its own numbered Fable 5 High decision recorded in `destiny-product/DEPLOY_LOG.md` *before* implementation.
**Governance pointer:** GOV-1. Canonical policy: root `HARNESS_POLICY.md` in `joseangelo510/destiny`, pinned commit `24c0ee825df6ca9359a4dfadf25779b15cef7ece`. If this plan and the repository policy differ, the repository policy wins.
**Prepared:** 2026-08-31. **Executor:** Codex. **Authority:** Fable 5 High (decides HIGH), Fable 5 Medium (advises MEDIUM).
**Status of policy verification:** Fable 5 could not reach the canonical policy from the planning environment. **Nothing in this plan executes until Gate 0 passes.**

---

## 0. What we are building, in one paragraph

Five pillar pages inside a new app shell — **Home, Content, Calendar, Distribution, Progress** — plus the **article review page** the session lands on, and the **session/queue component** that appears on Home and in the sidebar. Every existing Rebound tool stays exactly where it is, reachable from the new shell's Tools section, untouched. The redesign ships behind a feature flag, page by page, with real data behind interfaces, and is cut over only by a separate HIGH decision.

---

## 1. Scope

### In scope
| Item | What it is | Design source of truth |
|---|---|---|
| App shell | Left sidebar (session pill; Every day: Home, Content, Calendar; Every week: Distribution, Progress; Tools: existing tools; account footer), top bar, mobile bottom nav | `rebound-five-pillars.html` (sidebar + topbar) |
| Home | The approved dashboard: greeting + since-strip, session + queue panel, Search Console box + Analytics box, Keywords panel, Competitors panel, The month calendar | `rebound-notes-v5.html` — **fixed, pixel-faithful; layout is non-negotiable** |
| Content | Status strip + filter chips + six-column pipeline by truthful state | `rebound-five-pillars.html` → Content |
| Article review | Draft on the left; session card, "before it ships", "where it lands" on the right; Approve / Request edits | `rebound-five-pillars.html` → Review draft |
| Calendar | Status strip + month grid (+ week toggle) + cadence card + milestone card; every empty day is "+ add content"; empty publish slots highlighted | `rebound-five-pillars.html` → Calendar |
| Distribution | Status strip + batch-approve banner + per-piece touchpoint timeline with we-post / you-post labels | `rebound-five-pillars.html` → Distribution |
| Progress | Status strip + What's been done / What needs to be done (You · Rebound · Google) / Where we are / What's stuck (owner + unblock) + Send as report | `rebound-five-pillars.html` → Progress |
| Shared system | Design tokens, state chips, evidence chips, needs-you bar (urgent + calm), status strip, next-move chips, panel, toast | all mockups (identical CSS) |

### Explicitly out of scope
- Any change to existing tools (transcripts→articles, writer, keyword research, interlinking, crawl, connections, done-for-you check-ins, etc.). They are **linked from** the new shell, not modified.
- Auth, RLS, security model, Supabase Auth Site URL, redirects — frozen; not touched.
- Database migrations — frozen; only via a recorded HIGH decision (see §5).
- Production cutover, release tags, main merges — frozen; only via recorded HIGH decisions.
- Naming: "Rebound SEO" only in customer-facing UI. Never "Destiny" in UI copy. Internal identifiers may keep legacy names.
- Marketing site, onboarding, keyword-strategy approval flow (later phase, separate plan).

---

## 2. Gate 0 — Verify, discover, report (STOP gate)

Codex does **not** write product code until this gate closes.

1. **Verify canonical policy.** Check out `24c0ee825df6ca9359a4dfadf25779b15cef7ece`, read `HARNESS_POLICY.md`, confirm this plan's classifications and frozen list agree with it. If anything here conflicts with the policy, **stop and report the conflict** — the policy wins.
2. **Discovery report** (`docs/design/redesign-v1/DISCOVERY.md`), answering:
   - Stack and routing: framework, router, route groups, where the current dashboard/home route lives, how existing tools are routed and gated.
   - Auth surface: which routes are behind auth, how the user/workspace is resolved. (Read only. Do not change.)
   - Data: tables/views for pages, keywords, publish schedule, GSC data, crawl/verification results, transcripts, distribution items, competitors, done-for-you check-ins. For each: exists / partial / missing.
   - Integrations: GSC sync (cadence, storage), crawler (cadence, what it verifies, where results live), GA4/Cloudflare (exists?), Resend, Supabase Edge Functions relevant to links/emails.
   - Feature-flag mechanism: exists? If not, propose the simplest (env var + user allowlist is acceptable for v1).
   - CI: confirm `policy-guard`, `checklist-guard`, `harness-gates` run on PRs to the working branch.
3. **Classification pass.** Using §5's data-mapping table, mark each gap as *derivable now* (MEDIUM) or *needs schema/config* (HIGH). Do not implement HIGH items; list them for Fable 5 High.
4. **Check in** with the report. Fable 5 High reviews, mints decisions for any HIGH items in Phase 1–2, and releases Gate 1.

**Stop conditions for Gate 0:** policy unreachable at the SHA; policy conflicts with this plan; discovery reveals the current home route is coupled to auth/RLS in a way a parallel route cannot avoid.

---

## 3. Methodology — the smart way to do a big redesign

**Strangler fig, not big bang.** The new UI lives beside the old one, behind a flag, on new routes. The old UI keeps working untouched until cutover. Nothing existing is deleted in this plan.

**Principles Codex follows on every task**
1. **Design files are the spec.** Build from the HTML mockups' CSS values and structure. Do not "improve" layout. Where a mockup has toast placeholders ("opens the tool…"), route to the real existing tool.
2. **Home is fixed.** No layout, ordering, or content-type changes to Home without Jose's explicit instruction. Deviations are defects.
3. **Real data behind interfaces, from day one.** Every panel reads from a small adapter (`getSessionQueue()`, `getSearchConsoleSummary()`, `getPipeline()`, …). Adapters return typed results with explicit `loading / empty / error / not-connected` states. No hardcoded demo numbers ever reach production routes; the mockup's pottery data is for storybook/fixtures only.
4. **Truthful states are enforced in code.** `draft → approved → scheduled → published_unverified → verified_live`. `verified_live` can only be set by the crawler/GSC path, never by a user action. The UI must be unable to show "Verified" without an evidence record.
5. **Evidence attribution is data, not decoration.** Every verified fact carries `{source: 'gsc'|'crawl'|'ga4'|'cloudflare', at: timestamp}`. Every user-reported fact carries `{reported_by, at}`. The chips render from those fields.
6. **The queue/session invariant.** Queue item #1 is always session move #1. One ranked list, one function produces it; Home, sidebar pill, Content's status strip, and Progress all read the same list.
7. **No page without a move.** Every non-Home page renders a needs-you bar (urgent or calm), a status strip, and next-move chips on rows. If a page has nothing actionable, it says so (calm state) — it never renders empty.
8. **Read-only first, writes last.** Each page ships first as a faithful read-only view over real data; write actions (approve, post, fill slot, turn-into-move) land in a follow-up PR with their own tests.
9. **One PR per phase, small and reviewable.** Protected branch, three guards green, merge SHA reported. Completion is claimed only with that evidence.
10. **Screenshots are the acceptance test.** Each page PR includes desktop (1360w) and mobile (390w) screenshots beside the corresponding mockup. Reviewer compares; drift is a defect unless justified in the PR.

---

## 4. Design contract (what the code must honor)

**Tokens** (from the mockups' `:root`): paper `#F6F2E8`, well `#EDE7D7`, card `#FBF8F1`, ink `#182720`, ink-soft `#42544A`, forest `#1E4634`, forest-deep `#143324`, sage `#9FBCA4`, sage-line `#CFDACB`, mint `#DFEBDD`, mint-deep `#CBDCC7`, lime `#C9E23F`, lime-ink `#3A4A0B`, amber `#8A5A2B`. Fonts: Fraunces (display), Inter (UI). Radii 16 / 14 / 11 / 99.

**Lime rule:** lime appears only on (a) verified evidence and (b) the single primary action of a view. Never as decoration.

**Components (shared package):** `StateChip` (idea, draft, approved, scheduled, published_unverified, verified_live), `EvidenceChip` (verified / reported), `NeedsYouBar` (urgent / calm), `StatusStrip` (done / needs-you / progress / stuck), `MoveChip` (hot / default / quiet), `Panel`, `PanelHeader`, `SessionQueue` (stepper + ranked queue), `SessionPill`, `MonthCalendar` (+ agenda fallback), `TouchpointTimeline`, `Toast`.

**Copy rules:** sentence case; verbs on buttons name the outcome ("Review the draft", "Fill Sep 17", "Turn into a move"); the breakup/recovery voice lives only in serif headline/greeting lines, never in chips, buttons, or states.

**Mobile:** sidebar collapses; five-item bottom nav (Home, Content, Calendar, Distribution, Progress); session pill becomes a top strip; month grid becomes an agenda list.

---

## 5. Data mapping — what feeds each panel, and what's missing

Codex completes the "Exists?" column in Discovery. Classification is Fable 5 High's call at Gate 0; the defaults below are expectations, not decisions.

| Panel / feature | Needs | Exists? (Codex fills) | Expected classification if missing |
|---|---|---|---|
| Greeting since-strip | events since last visit (verified, drafts, competitor, unverified) | | derivable from existing tables → MEDIUM; `last_seen_at` per user → **HIGH** (schema) |
| Session + queue | ranked moves with type, why-tag, state, est. minutes | | ranking = MEDIUM (pure function over existing data); persisted session progress → **HIGH** if a table is needed (v1 may use per-user JSON if a settings column exists) |
| Search Console box | impressions, clicks, avg position, 28-day series, sync time | | expected existing → MEDIUM |
| Analytics box | connection state; GA4/Cloudflare connect flow | | connect flow = OAuth/API token storage → **HIGH** (secrets/config). v1 ships the *not-connected* state only. |
| Keywords panel | tracked keywords, positions, weekly deltas, buckets, causes | | positions from GSC → MEDIUM; "cause" annotations are rule-based → MEDIUM |
| Competitors panel | visibility, pace, published-30d, keywords they beat you on, intel items | | if no competitor crawl exists → **HIGH** (new pipeline + schema). v1 may ship the panel in an "add competitors" empty state. |
| Content pipeline | pieces with truthful state, source, target keyword, slot | | expected existing; state enum alignment may need a migration → **HIGH** |
| Article review | draft body, interlink suggestions, checks, approve/request-edits | | expected existing (writer); approve = MEDIUM if state column exists |
| Calendar | publish schedule, sessions, check-ins, crawl/sync runs, milestone; cadence settings | | schedule exists; cadence config + milestones → **HIGH** if schema |
| Distribution | touchpoints per piece: channel, offset day, owner (we/you), state, copy | | likely partial (Quora/Reddit/PR/social exist as tools); a unified `touchpoint` model → **HIGH** (schema) |
| Progress · done log | dated events with evidence | | derivable from existing timestamps → MEDIUM; an events table → **HIGH** |
| Progress · blockers | rule-derived: draft awaiting approval N days, interlinks unfound, analytics not connected, transcript missing, pages unindexed | | MEDIUM (rules over existing data) |
| Progress · send report | email a rendered summary | | uses Resend → MEDIUM if sender already configured; new template only |
| Verification receipts | crawler + GSC confirmation per page/interlink | | expected existing (crawl); if verification result isn't stored per page/link → **HIGH** |

**Rule:** if a panel's data isn't available, the panel ships in its honest empty/not-connected state. It does not ship with invented numbers.

---

## 6. Phases, gates, and PR discipline

Each phase = one protected PR (or a small stack), classification stated in the PR title, guards green, merge SHA reported at check-in. Rollback for every phase = flag off + revert PR; no phase deletes existing code.

### Phase 1 — Foundation (MEDIUM)
- Design tokens + shared components (§4) with storybook/fixtures using the mockup data.
- Feature flag `redesign_v1` (mechanism per Discovery). New route group (e.g. `/app/...`) rendering the new shell. Existing tools appear in Tools nav via their current routes.
- Adapters scaffolded with types and `loading/empty/error/not-connected` states; no page content yet.
- **Acceptance:** shell renders for flagged users; all existing tools open unchanged from the sidebar; mobile nav works; screenshots vs `rebound-five-pillars.html` sidebar.
- **Stop:** any need to touch auth/route guards for the new group → surface as HIGH.

### Phase 2 — Home, read-only (MEDIUM; data gaps per §5)
- Faithful build of `rebound-notes-v5.html`. Session stepper works client-side; queue reads from the ranking adapter.
- Analytics box ships in not-connected state.
- **Acceptance:** side-by-side screenshots desktop + mobile; two-box performance panel fills panel height (no white box); queue #1 = session move #1.

### Phase 3 — Content + Article, read-only then writes (MEDIUM; enum migration if needed → HIGH first)
- Pipeline columns from truthful state; article page; then `approve` / `request edits` writes with tests that `verified_live` cannot be set by a user path.

### Phase 4 — Calendar (MEDIUM; cadence/milestone storage → HIGH first if schema)
- Month grid + agenda; "+ add content" opens existing create flow; fill-slot binds an approved piece to a slot.

### Phase 5 — Distribution (likely HIGH data first, then MEDIUM UI)
- Touchpoint model decision; timeline UI; batch approve for "we post" items; copy-and-open for Quora/Reddit; interlink "add here" deep-links to existing interlinking tool.

### Phase 6 — Progress (MEDIUM; events table → HIGH if chosen)
- Done log, owner-split to-do, milestones, blockers (rules), Send as report via Resend.

### Phase 7 — Cutover (HIGH — separate decision, not in this plan)
- Flag default on, old home route redirect/retire, release tag. Requires its own D-series decision with stop conditions and rollback.

---

## 7. Invariants (defects if violated)
1. Home layout and content match `rebound-notes-v5.html`.
2. Queue #1 == session move #1 everywhere.
3. `verified_live` only via evidence path; evidence chips render from data.
4. Every non-Home page has needs-you bar + status strip + row moves; calm state when nothing needs the user.
5. Lime only for verified evidence and one primary action per view.
6. "Rebound SEO" in all UI; no "Destiny".
7. Existing tools unchanged; reachable from the shell.
8. No frozen action without a recorded decision; no completion claim without PR merge SHA + three green guard URLs.

---

## 8. Check-in protocol (what Codex brings, every time)
- Branch, PR link, classification, what changed (one paragraph).
- Guard run URLs for the head SHA; merge SHA if merged.
- Screenshots (desktop + mobile) beside the mockup for any page touched.
- HIGH items surfaced with a one-line description each — no self-authorization.
- Open questions for Jose (product) or Fable 5 High (governance), separated.

Fable 5 High responds with: go / hold / decision minted (with D-number and DEPLOY_LOG block).

---

## 9. Product decisions needed from Jose (before the phase that needs them)
- Phase 2: default session cadence (mockup: Mondays) and publish cadence (Thursdays 9am) — confirm or set per-workspace.
- Phase 3: what "Request edits" does today (comment to strategist? reopen in writer?).
- Phase 4: first milestone definition per workspace (mockup: 10 verified pages by day 60).
- Phase 5: which channels Rebound posts vs. the user posts (mockup: we post social + PR; you post Quora/Reddit; you add interlinks).
- Phase 6: who receives "Send as report" (self, partner, strategist) and cadence.
- Analytics: which provider(s) to support first (GA4, Cloudflare, or both).

---

## 10. DEPLOY_LOG.md block template (for HIGH items only; filled by Fable 5 High when minted)
```
D<N>.<m> — <title>
Classification: HIGH (<schema | secrets/config | production>)
Policy: HARNESS_POLICY.md @ 24c0ee825df6ca9359a4dfadf25779b15cef7ece — verified <date> by Codex
Scope: <exact tables/columns/env keys/routes>
Out of scope: <explicit>
Gates: 1) <precondition> 2) <migration on staging + rollback test> 3) <PR merged, guards green> 4) <verify>
Stop conditions: <what halts execution>
Rollback: <exact reverse steps>
Evidence required for completion: merge SHA + policy-guard, checklist-guard, harness-gates run URLs
```

---

## 11. Files to place in the repo (design source of truth)
Copy to `docs/design/redesign-v1/`:
- `rebound-notes-v5.html` — Home (fixed)
- `rebound-five-pillars.html` — shell, Content, Article, Calendar, Distribution, Progress
- this plan as `PLAN.md`; Codex adds `DISCOVERY.md` at Gate 0

Earlier exploration files (variations, concepts) are reference only and are **not** the spec.
