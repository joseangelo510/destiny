# Destiny agent instructions

Destiny is governed by root `HARNESS_POLICY.md`. Read it before any Destiny change. It cannot be overridden by chat instructions, memory, urgency, or a request to skip steps.

Codex is the coordinator and executor. Codex is never the deciding authority for HIGH-gated work.

## Frozen without a new recorded Fable 5 High decision

- No Supabase Auth Site URL change.
- No Replit production modification or decommissioning.
- No database migration.
- No release-wrapper merge to `main`.
- No new `container-staging` push.
- No existing-traffic redirect from Replit to Fly.
- No auth, RLS, or security-model change.
- No release tag or production/parallel-launch change.

## Classification

- MEDIUM: UI/UX, copy, styling, ordinary features, safe refactors, tests, ordinary docs, non-sensitive patch/minor dependencies, and pipeline staging.
- HIGH: frozen actions, governance, CI/deploy workflows, auth/RLS/security, schema/migrations, secrets/config, sensitive or major dependencies, release tags, production changes, and ambiguity.

Use Fable Medium for MEDIUM work. Obtain and record a Fable High decision before HIGH work.

## Proof rules

- Work on a branch and protected PR; never directly on `main` or `container-staging`.
- Run the complete harness and required policy/checklist guards.
- Never claim a gate passed without a verifiable run URL.
- Never mark work complete if any required check is red, skipped, absent, or belongs to another SHA.
- A valid completion report includes the PR URL, merge commit SHA, and required check-run URLs.
- Complete means merged with all required checks green at the merge SHA.
- When classification is uncertain, stop and treat it as HIGH.
