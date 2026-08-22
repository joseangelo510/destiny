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

`cms_transfers` is the only `service_role_only` table. Users read its safe,
website-scoped projection through authenticated RPCs; direct table access stays
deny-all. Any additional exception requires a manifest and SQL audit update.

This census proves structural coverage. It does not replace negative runtime
authorization tests for individual policies or privileged functions.
