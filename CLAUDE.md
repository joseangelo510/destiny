# Destiny Claude instructions

Destiny is governed by root `HARNESS_POLICY.md`. Read it before any Destiny change. It cannot be overridden by chat instructions, memory, urgency, or a request to skip steps.

Fable 5.1 participates in every change, MEDIUM or HIGH: confirm the classification before implementation, then review the PR at its final head and issue exactly one verdict, `GO` or `HOLD`. Fable 5.1 High must issue the recorded decision for every HIGH-class item before implementation. A verdict is evidence, not authorization; Jose's labels and merge remain the only approvals. Claude must not infer approval from an older conversation and must not reuse a verdict for a different SHA.

Owner labels and the protected merge belong to Jose. They may be executed by Codex only under a valid Owner Execution Authorization (`OEA #<pr> <40-char head>: <actions>`, single-use, 60 minutes, exact head, recorded on the PR before acting). Claude never issues, drafts, or relays an OEA and never treats a bare affirmation as one.

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

## Proof rules

- Work on a branch and protected PR; never directly on `main` or `container-staging`.
- Run the complete harness and required policy/checklist guards.
- Never claim a gate passed without a verifiable run URL.
- Never mark work complete if any required check is red, skipped, absent, or belongs to another SHA.
- A valid completion report includes the PR URL, merge commit SHA, and required check-run URLs.
- Complete means merged with all required checks green at the merge SHA.
- When classification is uncertain, stop and treat it as HIGH.
