# Destiny launch-readiness audit — 2026-08-17

Status: **PARTIAL — data isolation passed; delivery workflows are not yet launch-certified**

## Executive decision

Destiny's current saved production data shows no cross-site blending. The launch blocker is not tenant storage; it is incomplete proof and inconsistent capability across email delivery, CMS scheduling, and social distribution.

For a two-week MVP, certify one complete loop:

`keyword approval → editorial calendar → generated article → CMS draft/schedule → verified live URL → manual social handoff → weekly report`

Automatic social posting, direct Wix publishing, backlink outreach, and broad parity with Ahrefs/Semrush should remain out of the launch gate.

## Live account inventory

The primary organization contains 12 websites: Canva, Career Path Partners, ClearCheck, DatacenterDotDev / LogicCaffeine, Empowerly, Hardin AI, Jose Angelo Studios, 98 Junk IT, Mailchimp, Nike, RightModeler, and Smart & Fast Background Checks.

All latest audits are complete. Every latest provider payload inspected resolves to its website's normalized domain. Keyword arrays did not share an identical hash across sites.

### Data-isolation evidence

- 24 live parent/child and organization/site consistency checks: **0 mismatches**.
- Article drafts, integrations, keyword preferences, publishing plans, schedule items, CMS transfers, tracked keywords, observations, notification preferences, digest sends, notifications, directories, re-optimization documents, communications, quests, and keyword decisions remained attached to their expected site.
- Duplicate domains in other test organizations remained separate by organization ID and website ID.
- Current page queries in `getWorkspaceContext` filter audits, quests, competitors, integrations, and metrics by the selected website or its audit.
- Site navigation carries the website ID, while server context validates it against the user's RLS-filtered website list.

This is strong row-level evidence, not complete authorization certification. Foreign-ID writes and two-tab site switching still require a disposable second tenant.

## Website capability matrix

| Website | Keyword/rank data | CMS | Publishing schedule | Distribution | Ranking email |
|---|---:|---|---|---|---|
| ClearCheck | Yes | WordPress connected | 12-slot plan; one future WordPress post | Manual share handoff | Provider accepted one digest |
| Smart & Fast Background Checks | Yes | Webflow connected | No plan; three draft transfers without live verification | Manual share handoff | Provider accepted one digest |
| 98 Junk IT | Yes | Wix detected, not connected | None; Wix remains manual | Manual share handoff | Provider accepted one digest; inbox not confirmed |
| Jose Angelo Studios | Yes | WordPress profile, no live connection | None | Manual share handoff | Delivered to `jose@joseangelostudios.com` |
| RightModeler | Yes | None | None | Manual share handoff | Provider accepted one digest; inbox not confirmed |
| Hardin AI | Yes | None | None | Manual share handoff | Provider accepted one digest; inbox not confirmed |
| DatacenterDotDev / LogicCaffeine | Yes | None | None | Manual share handoff | Provider accepted one digest; inbox not confirmed |
| Career Path Partners | No tracked keywords | None | None | Manual share handoff | Skipped truthfully: no tracked keywords |
| Other test sites | Sparse/test data | None | None | Manual share handoff | Mostly skipped or not applicable |

## Defects found and fixes prepared

1. **Email acceptance was mislabeled as delivery.** The app stored a successful Resend API response as `sent`, even when Gmail received nothing. A migration and digest reconciliation now distinguish `accepted`, `delivered`, and `failed`, and poll Resend's message event.
2. **Digest opportunity source was wrong.** Rank digest queried `audits.raw_provider_payload`; the payload is stored in `audit_metrics.raw_provider_payload`. The query now reads the metric relationship.
3. **Report destinations were opaque.** Account settings now show the exact recipient and latest delivery state for every website.
4. **Social buttons shared homepages.** Distribution now selects only the current site's latest verified published CMS transfer. If none exists, it labels the homepage fallback honestly.
5. **Cadence expectation was unclear.** Existing sites were forced to every three days, while the requested product is a weekly report. Weekly is now presented as the recommended cadence; changing existing production preferences is a separate deployment decision.

## Keyword-quality findings

- 98 Junk IT, ClearCheck, Smart & Fast, Jose Angelo Studios, RightModeler, and Hardin AI currently show domain-appropriate keyword sets.
- Empowerly still contains one unrelated high-yield-savings keyword among admissions terms.
- Career Path Partners contains several broad or mismatched suggestions.
- DatacenterDotDev includes poor zero-volume phrases.

These are candidate-generation/scoring defects, not evidence of identical cross-site data reuse. Before launch, recommendation quality should reject zero-volume and weak business-fit phrases and require service/audience relevance evidence.

## Claude/Fable 5 High test methodology adopted

1. Seed two organizations with a duplicate domain and unmistakable marker keywords.
2. Verify positive isolation across strategy, recommendations, calendar, articles, schedule, social target, and report.
3. Attempt every API and Edge Function with foreign website, audit, plan, integration, and draft IDs; require a hard denial and zero inserted rows.
4. Switch sites repeatedly, in two tabs and mid-flow; every server fetch and client storage key must include website ID.
5. Run WordPress, Webflow, and Wix as separate CMS capability tracks. Never count a draft as published.
6. Require three receipts for every launch cell: database row, UI screenshot or live URL, and provider/job log.
7. Treat silent failure as a launch blocker.

## MVP parity: what matters now

Current Ahrefs core tools cover competitor/site exploration, keyword research, site audit, rank tracking, content research, and AI visibility. Current Semrush positioning adds scheduled technical audits, position tracking, automated reports, content optimization, backlinks, local search, and AI visibility.

Destiny does not need full parity before launch. It does need:

- Site-specific keyword research and decision history.
- Weekly rank snapshots with top-3/top-10/top-20/top-100 movement.
- A prioritized technical audit with re-checks.
- Editorial calendar and article quality gates.
- Truthful WordPress scheduling plus clearly labeled Webflow/Wix handoff.
- A verified article share target and manual distribution completion state.
- Weekly email with a real recipient and confirmed provider delivery.
- Visible errors and retry paths.

Backlink outreach, full crawler depth, automatic social posting, and advanced competitor history should follow after the core loop is reliable.

## Release gates

### P0 — before accepting users

- Apply the delivery-state migration and deploy the corrected rank digest.
- Confirm one digest reaches `joseangelo85@gmail.com`; inspect Resend suppression/bounce state if it does not.
- Run a full WordPress loop on ClearCheck and Jose Angelo Studios.
- Run a Webflow draft loop on Smart & Fast and label manual publishing accurately.
- Run the Wix manual-export loop on 98 Junk IT; do not advertise direct Wix publishing.
- Create a disposable second tenant and pass foreign-ID write tests.
- Re-run the read-only SQL isolation audit and require zero rows.

### P1 — first week after core certification

- Add a per-site distribution queue with draft copy, selected live URL, completion evidence, and channel status.
- Add weekly technical re-audit scheduling.
- Add a recommendation-quality regression corpus for every industry represented in the account.
- Add Webflow publishing status reconciliation.

## Verification completed in this change

- ESLint: pass.
- QA inventory: 59 routes and 563 interactive/mutation surfaces.
- Full unit suite: 117 files and 633 tests passed using a standalone Node runtime.
- Production build: passed, including TypeScript and all 46 generated pages.
- Live public browser checks: desktop and mobile journeys/accessibility passed, 4 of 4.
- New focused tests: email event truth, CMS delivery-mode truth, and verified social share selection passed.

## Sources

- Ahrefs tool scope: https://ahrefs.com/faq
- Semrush tool scope: https://www.semrush.com/features/
- Semrush position tracking and weekly reports: https://www.semrush.com/kb/32-position-tracking
- Semrush scheduled site audits: https://www.semrush.com/kb/1184-audit-your-website
- Resend accepted vs delivered events: https://resend.com/docs/webhooks/event-types
- Resend sent-email status retrieval: https://resend.com/docs/api-reference/emails/retrieve-email
