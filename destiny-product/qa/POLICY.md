# Destiny test harness policy

Destiny uses test-driven development to make regressions difficult to ship. The repository is the source of truth, GitHub Actions enforces the rules, Replit serves the tested commit, and Supabase supplies authentication, row-level security, migrations, and isolated test data. Supabase and Replit do not own separate copies of the harness.

## Required workflow

Every product change follows the same loop:

1. **Specify:** add or update `qa/specs/<feature>.md` with a user story, measurable acceptance criteria, Given/When/Then scenarios, and a Mermaid flowchart.
2. **Red:** write a test that fails for the missing behavior or reproduced defect. Record that commit in the pull request.
3. **Green:** make the smallest implementation that passes the new test.
4. **Refactor:** improve the implementation without changing the passing behavior.
5. **QA round 1:** the pull-request harness passes.
6. **QA round 2:** the exact merged commit passes on `main`.
7. **QA round 3:** the deployed commit passes the production read-only checks and isolation audit.

Agents build to satisfy the specification and tests. They may not weaken, delete, skip, or route around a failing test merely to make the harness green.

## Pull-request blockers

The required `ci` check from the repository-root `.github/workflows/ci.yml` must pass on the exact commit. It verifies:

- frozen-lockfile installation with Node.js 22 and pnpm 11.9.0;
- a freshly generated and committed route/control inventory;
- append-only migration filenames and the recorded production migration ledger;
- lint;
- the full Vitest suite;
- the production build; and
- public and local Playwright journeys on desktop and mobile.

No direct push to `main` should bypass this check.

## Production blockers

Production promotion requires:

1. the exact `main` commit to have a green `ci` check;
2. all production-applied migrations to be recorded in `scripts/qa-migrations.mjs`;
3. a green production read-only Playwright run;
4. zero rows from `qa/sql/site-isolation-audit.sql`; and
5. rollback or a same-day forward fix if any post-deploy check turns red.

## Production is read-only to the harness

Production browser checks may use GET, HEAD, and OPTIONS only. The authentication token refresh endpoint is the sole allowed exception. A mutation attempt is itself a test failure even if the server blocks it. Production checks never use service-role credentials or create, update, publish, schedule, email, connect, or delete customer data.

Mutating integration and journey tests belong in a disposable staging tenant. Smart & Fast Background Checks remains the default production read-only workspace until the product owner changes that decision.

Public pull-request browser tests use only the reserved `supabase.invalid` hostname and a non-secret placeholder publishable key. This keeps forked pull requests safe and proves that public pages and unauthenticated redirects do not depend on a live database. Authenticated browser journeys run only in the separate `QA_AUTH_STATE` lane.

## Critical invariants

- An unauthenticated user cannot render a workspace page or call a protected API.
- Every record, link, recommendation, task, notification, draft, schedule, CMS transfer, interview, and result remains scoped to the selected website and authenticated organization.
- A draft is never represented as published; a scheduled item is never represented as live.
- CMS automation creates drafts unless the user separately authorizes publication.
- Wix remains an honest manual handoff until a verified direct integration exists.
- Interview answers and voice context never cross website boundaries and never publish automatically.
- Production QA remains non-mutating.

## Evidence

Generated inventory stays in `qa/inventory/`. Playwright traces, screenshots, videos, and reports stay in `qa/artifacts/` and are uploaded when CI fails. Test reports must distinguish verified evidence from planned, queued, self-reported, or blocked states.
