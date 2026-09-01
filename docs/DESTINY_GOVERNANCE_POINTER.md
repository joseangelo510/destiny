# Destiny Governance Pointer

Destiny's canonical governance source is root `HARNESS_POLICY.md` in `joseangelo510/destiny`. If this pointer and the repository differ, the repository policy wins. Do not edit this pointer except after a merged policy change.

## Frozen without a new recorded Fable 5 High decision

- Supabase Auth Site URL changes
- Replit production modification or decommissioning
- Database migrations
- Release-wrapper merges to `main`
- New `container-staging` pushes
- Existing-traffic redirects from Replit to Fly
- Auth, RLS, or security-model changes
- Release tags and production or parallel-launch changes

## Classification

- MEDIUM: ordinary UI/UX, copy, features, safe refactors, tests, documentation, non-sensitive patch/minor dependencies, and pipeline staging.
- HIGH: every frozen action, governance, CI/deploy workflows, auth/RLS/security, schema/migrations, secrets/config, sensitive or major dependencies, release tags, production changes, and ambiguity.

Fable Medium is sufficient for MEDIUM. Fable High must decide HIGH before implementation. Codex coordinates and executes; it does not decide HIGH.

Mirror metadata:

- Policy version: `GOV-1`
- Canonical policy commit: `14cbda0e36fe217892cdfd1e4946c036edfb1e55`
