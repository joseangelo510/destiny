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

Fable 5.1 participates in every change: it confirms the classification before implementation and must issue a `GO` verdict at the PR's final head before merge, for MEDIUM and HIGH alike. Obtain and record a Fable 5.1 High decision before HIGH work. Codex never classifies alone and never writes, edits, or reuses a Fable verdict. If Fable 5.1 is unavailable, stop.

Owner labels and the protected merge are Jose's. Codex may execute them only under a valid Owner Execution Authorization from Jose in the form `OEA #<pr> <40-char head>: <actions>`, single-use, 60 minutes, exact head, with a delegation record comment posted on the PR before acting. "Just go" is not an OEA. Never take any other action from Jose's GitHub session.

## Proof rules

- Work on a branch and protected PR; never directly on `main` or `container-staging`.
- Run the complete harness and required policy/checklist guards.
- Never claim a gate passed without a verifiable run URL.
- Never mark work complete if any required check is red, skipped, absent, or belongs to another SHA.
- A valid completion report includes the PR URL, merge commit SHA, and required check-run URLs.
- Complete means merged with all required checks green at the merge SHA.
- When classification is uncertain, stop and treat it as HIGH.
