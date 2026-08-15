# Staging reconciliation — 2026-08-14

## Boundary

- Production project was not changed.
- Validation target: Supabase development branch `destiny-staging-2026-08-14` (`riegpjoxnswcaydqbyio`).
- No production data was copied to staging.

## Reconciled

- Local migration filenames now match the 37 migrations recorded in production.
- Restored the previously untracked `llm_visibility_tasks` schema as an idempotent forward migration.
- Added website-specific notification email storage while retaining the account email as a legacy fallback.
- Added the missing foreign-key index for `llm_visibility_tasks.completed_by`.
- Deployed staging version 2 of `process-audit` and `send-welcome`.
- Corrected the audit-ready notification update to use the selected website ID.
- Applied prior keyword approvals and declines to future audit recommendations without suppressing unrelated keywords.
- Corrected service-provider phrases such as “agency” and “experts” to commercial/consideration intent.

## Evidence

- Staging migration history contains all 37 production migrations plus three forward migrations.
- `llm_visibility_tasks` exists with RLS enabled, three authenticated-member policies, proof columns, and covering indexes.
- `websites.notification_email` exists with a normalized-email constraint.
- Two-tenant RLS check passed in both directions: each account saw one own website, one own keyword preference, and one own LLM task; each saw zero rows from the other account and could not update the other website.
- Temporary tenants were removed after the test (`remaining_qa_users = 0`).
- Supabase security advisor reported only the existing intentional service-role-only `cms_transfers` table.
- ESLint passed.
- Vitest passed: 109 files, 562 tests.
- Next.js production build passed: 43 static pages and 56 total routes inventoried.
- Playwright public suite passed on desktop and mobile: 6 passed, 32 authenticated production checks skipped by design.
- A disposable authenticated Smart & Fast account completed a staging audit from 10% to 100%, produced metrics, eight quests, a website-scoped audit-ready notification, and the expected audit results path.
- Website email selection was exercised end to end. The `.invalid` QA recipient was correctly classified as non-deliverable, so no external email was sent; the audit recorded `emailDelivery.status = skipped`.
- All authenticated audit fixtures were removed after validation (user, website, and audit counts returned to zero).

## Release gate still required

The staging branch does not inherit the production `DATAFORSEO_*` and model-provider secrets, so its authenticated audit correctly used the demo provider. Before production release, configure those secrets on staging, rerun the same audit with live providers, verify a deliverable email in a controlled inbox, and complete the existing Smart & Fast production read-only route sweep. Production promotion must remain a reviewed action.
