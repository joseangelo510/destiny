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

Fable 5.1 participates in every change: classification confirmation before implementation and a `GO` verdict recorded at the exact PR head before merge, for MEDIUM and HIGH alike. Fable 5.1 High must decide HIGH before implementation. Codex coordinates and executes; it does not decide HIGH, does not classify alone, and never writes a Fable verdict. If Fable 5.1 is unavailable, stop.

Owner labels and the protected merge are Jose's. Codex may execute them only under a valid Owner Execution Authorization from Jose (`OEA #<pr> <40-char head>: <actions>`; single-use; 60 minutes; exact head; delegation record on the PR before acting).

Mirror metadata:

- Policy version: `GOV-1.2`
- Canonical policy commit: the latest protected `main` commit that touched `HARNESS_POLICY.md` (`git log -1 --format=%H origin/main -- HARNESS_POLICY.md`). The cloud pointer must name that SHA after each policy merge.
