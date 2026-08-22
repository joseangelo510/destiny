# Destiny test harness

## User story

As Destiny's product owner, I want every product change to prove its intended behavior and preserve existing critical journeys before it can merge or deploy, so coding agents can add features without silently breaking customer workflows or mixing website data.

## Acceptance criteria

1. Pull requests and pushes to `main` run the same locked Node.js, pnpm, inventory, migration, lint, test, build, and Playwright checks.
2. Any failed check makes the GitHub `ci` job red.
3. A route or interactive control added without refreshing `qa/inventory/` makes CI red.
4. A malformed, duplicated, missing, or renamed recorded migration makes CI red.
5. Browser artifacts are retained for fourteen days when Playwright or another CI step fails.
6. The local `pnpm gate` includes the migration check and remains the developer/agent pre-push command.
7. The policy documents red-green-refactor and forbids weakening a test to bypass a failure.
8. The deployed application remains unchanged by Phase 0.
9. Public browser tests run from a clean clone without Supabase secrets or a live Supabase connection.

## Scenarios

### Scenario: a regression cannot merge

**Given** a pull request changes Destiny behavior

**And** an existing unit or browser test fails

**When** GitHub Actions runs the `ci` job

**Then** the required check is red

**And** the pull request cannot merge after branch protection is enabled.

### Scenario: inventory drift is visible

**Given** a route or interactive control changes

**When** the QA inventory generator produces a diff

**Then** CI fails until the generated inventory is reviewed and committed.

### Scenario: migration history remains recoverable

**Given** a migration has been applied to production

**When** a later change deletes, renames, duplicates, or malformedly names that migration

**Then** `pnpm qa:migrations` fails before the change can merge.

### Scenario: production remains untouched by QA

**Given** a post-deploy production check is running

**When** the browser attempts a mutating Destiny or Supabase request

**Then** the read-only guard blocks it

**And** the test fails with the attempted request recorded as evidence.

## Flow

```mermaid
flowchart LR
  A[Write specification] --> B[Write failing test]
  B --> C[Red commit]
  C --> D[Implement smallest change]
  D --> E[Local pnpm gate]
  E -->|red| D
  E -->|green| F[Pull request CI]
  F -->|red| D
  F -->|green| G[Merge exact commit]
  G --> H[Deploy to Replit]
  H --> I[Production read-only QA]
  I -->|red| J[Rollback or hotfix forward]
  I -->|green| K[Verified release]
```

## Phase boundary

Phase 0 enforces the harness that already exists. It does not add customer-facing behavior, create a staging tenant, or introduce mutation in production. Repository-rule tests, a disposable two-tenant write matrix, scheduled production QA, and automated SQL isolation execution are subsequent phases governed by this same specification.
