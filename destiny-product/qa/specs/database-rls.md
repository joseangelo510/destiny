# Database RLS census

Every public application table is registered in `qa/inventory/database-rls.json`.
The manifest is an explicit review boundary: adding a table without classifying
its tenant scope and access mode fails the unit gate.

## Required controls

- Every public application table enables row-level security.
- An `authenticated` table has at least one declared policy. Its detailed
  tenant relationships remain covered by migrations, the three-site isolation
  matrix, and the cross-parent SQL poison audit.
- A `service_role_only` table intentionally has no authenticated policies. It
  is deny-all through the public API and may only be accessed behind a separately
  tested privileged boundary.
- The disposable Supabase job queries the migrated Postgres catalog. A table
  with RLS disabled or a missing authenticated policy fails CI even if the
  migration text looked correct.

## Reviewed exception

`cms_transfers` is a `service_role_only` table. Users read its safe,
website-scoped projection through authenticated RPCs; direct table access stays
deny-all. Any additional exception requires a manifest and SQL audit update.

`billing_stripe_events` is also service-role-only under D10.40. It stores event processing receipts, never browser-readable payment payloads. `billing_accounts` and `billing_usage` permit authenticated owner reads only; mutation and reservation RPCs are service-role-only. `qa/isolation/billing.integration.test.ts` verifies owner isolation, denied browser mutations, concurrent reservation and expiry behavior.

This census proves structural coverage. It does not replace negative runtime
authorization tests for individual policies or privileged functions.

`billing_managed_websites` has authenticated owner-only reads and service-only mutations. Four service-only SECURITY INVOKER functions read capacity, snapshot selection, replace owned selections under owner/account locks, and test valid managed membership. Browser roles cannot call these functions directly. `managed-websites.integration.test.ts` verifies owner/member isolation, selection concurrency, foreign-site denial, downgrade preservation and the unchanged count of saved websites.

Transactional email attempt budgets are service-role-only, with verified actor membership and an owner profile lock. Real concurrent owner/member tests enforce five progress attempts per rolling day and two lifetime welcome attempts, duplicate and browser-RPC denial. Site deletion retains attempt counts.
