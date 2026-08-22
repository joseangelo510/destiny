# Hosted grant and policy conformance

## User story

As a Destiny customer, I need database privileges and row-level policies to
agree so that my permitted actions work while no browser role can bypass tenant
isolation or inherit unsafe PostgreSQL privileges.

## Acceptance criteria

1. `anon` has no privileges on application tables, sequences, views, or public
   functions.
2. `authenticated` has only policy-backed CRUD privileges on public tables.
3. `authenticated` never has `TRUNCATE`, `TRIGGER`, or `REFERENCES` on an
   application table.
4. Every authenticated INSERT, UPDATE, or DELETE policy has its matching table
   privilege, and every matching privilege has a policy.
5. SELECT may be granted as the dependency for a policy-backed CRUD operation,
   but an authenticated table with no reviewed policy has no privileges.
6. Policies created for `public` are tightened to `authenticated` because
   Destiny has no anonymous workspace data path.
7. Public functions are not executable through PostgreSQL's implicit `PUBLIC`
   grant. Only the reviewed authenticated RPCs remain callable.
8. An owner can update their own website and mark their own notification read.
9. Cross-tenant reads stay empty; cross-tenant writes are either a grant-layer
   403 or an RLS-layer zero-row result according to the reviewed grant matrix,
   and the owner's row remains unchanged.

## Scenarios

### Owner operations remain functional

**Given** an authenticated owner with one website and one notification

**When** the owner updates the website and marks the notification read

**Then** both mutations return the owner's row and persist the requested value.

### Unsafe inherited privileges are absent

**Given** a freshly migrated hosted-parity database

**When** the conformance audit compares table grants, policies, function ACLs,
sequence ACLs, and views

**Then** it returns zero rows.

### Anonymous access is denied at the grant layer

**Given** an unauthenticated browser client

**When** it reads a non-allowlisted application table

**Then** PostgreSQL rejects the request rather than returning customer data.

```mermaid
flowchart LR
  A[Fresh database] --> B[Apply every migration]
  B --> C[Audit grants and policies]
  C -->|violations| D[Block release]
  C -->|zero rows| E[Run owner mutations]
  E --> F[Run three-tenant isolation]
  F -->|green| G[Release candidate]
```
