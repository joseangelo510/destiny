# Destiny Harness Policy

Policy ID: `GOV-1`

Status: active

Canonical repository: `joseangelo510/destiny`

This is the single source of truth for how Destiny changes are classified, tested, reviewed, merged, staged, released, and rolled back.

If any instruction conflicts with this file, stop and request a CTO decision. Conversational instructions do not override this file.

## Authority order

1. A new explicit decision from Jose Gallegos through Fable 5 High, recorded in `destiny-product/DEPLOY_LOG.md` before implementation.
2. This `HARNESS_POLICY.md` at the exact SHA being changed.
3. GitHub Actions workflows that implement this policy. If a workflow diverges, this policy wins and the divergence is a HIGH-gated defect.
4. Root `AGENTS.md` and `CLAUDE.md` pointers.
5. The Claude Project knowledge pointer.
6. Conversation history or agent memory.

No lower authority may weaken a higher authority.

## Roles

- Jose owns product intent and is the only actor allowed to apply the `cto-approved` and `policy-change` labels.
- Fable 5 Medium may review and advise on MEDIUM work.
- Fable 5 High is the deciding CTO authority for HIGH work.
- Codex coordinates and executes. Codex may not decide or self-authorize HIGH work.
- GitHub Actions is the enforcement system of record.

## Change classification

### MEDIUM

Fable Medium is sufficient when the change stays outside every HIGH and frozen surface:

- UI, UX, styling, copy, and accessibility;
- ordinary application features;
- refactors that preserve behavior and keep all gates green;
- test additions and non-governance documentation;
- dependency patch or minor updates that do not touch authentication, cryptography, payments, sessions, or Supabase access;
- staging verification through the existing pipeline;
- redeploying a prior immutable tag to staging.

### HIGH

Fable High must decide and the decision must be recorded in `destiny-product/DEPLOY_LOG.md` before work begins for:

- this policy or any enforcement workflow, script, agent pointer, or governance skill;
- authentication, OAuth, session, RLS, authorization, or security-model changes;
- database schema changes or migrations;
- secrets, environment variables, runtime configuration, or provider credentials;
- dependency major updates, new runtime dependencies, removals, or authentication, cryptography, payment, session, and Supabase dependency changes;
- production or parallel-launch cutovers, deploys, and rollbacks;
- release tags;
- CI or deployment workflow changes;
- any frozen action below;
- any ambiguous change. Ambiguity defaults to HIGH.

## Frozen actions

The following are forbidden without a new explicit Fable 5 High decision recorded in `destiny-product/DEPLOY_LOG.md`:

1. Change the Supabase Auth Site URL.
2. Modify or decommission Replit production.
3. Run or apply a database migration.
4. Merge the release wrapper into `main`.
5. Push a new commit to `container-staging`.
6. Redirect existing Replit traffic to Fly.
7. Change the authentication, RLS, or security model.
8. Create a release tag or mutate an existing release tag.

The parallel launch at `https://app.caminoseo.com` receives production changes only from an explicitly approved immutable release tag. Replit remains production of record for existing traffic until a new recorded decision says otherwise.

## Required workflow for every change

1. Branch from the canonical source. Never work directly on `main` or `container-staging`.
2. Classify the change as MEDIUM or HIGH before implementation.
3. For HIGH, record the Fable High decision in `destiny-product/DEPLOY_LOG.md` before the first implementation commit.
4. Use TDD where behavior or policy changes: record RED evidence, implement GREEN, then add QA coverage.
5. Open a PR using `.github/pull_request_template.md`.
6. Pass the full `pnpm gate`, including repository policy, commit policy, deploy-log policy, migration audit, dependency audit, ESLint and English-only rules, file-length ratchet, Vitest, isolation checks, production build, and Playwright journeys.
7. Verify the staging candidate build stamp matches the PR SHA and check touched routes with zero 5xx.
8. Pass `policy-guard`, `checklist-guard`, and `harness-gates` required checks.
9. Merge through protected `main`. Do not force push and do not use an admin bypass.
10. Create a release tag only under a separate HIGH decision.

## Harness v2 evidence contract

`.github/destiny-evidence.json` is the typed, schema-validated change contract. PR prose points to it but may not replace it. The contract declares classification, Fable decision provenance, exact replayable RED commits and focused argv commands, network mode, touched routes, and every changed non-test product path.

RED is accepted only when the declared tests are collected and fail for the declared reason at an ancestor commit. GREEN is accepted only when the same focused command passes at HEAD. A fail-then-pass remains red and is classified as flaky; retries never convert it to green. RED may be not applicable only for decision-record-only, docs-only, protected-revert, or generated-inventory-only diffs, and the exemption must match the actual diff.

The PR lane runs `pnpm qa:harness-v2` and produces versioned JSONL traces plus validation, architecture, changed-coverage, changed-mutation, and deterministic hash receipts under `destiny-product/qa/artifacts/harness/`. Network access fails closed unless a declared mode permits it. Application telemetry uses correlation IDs and versioned structured events with recursive secret and PII redaction.

Quality thresholds are measured ratchets. Architecture violations, dependency cycles, duplication, complexity, skips, quarantines, retries, lint warnings, and type errors may not increase. Changed coverage, mutation score, and journey coverage may not decrease. Raw test count is informational. Runtime uses fixed ceilings. Any temporary regression requires an expiring, owned exception backed by a new Fable High decision.

The scheduled assurance lane repeats selected browser journeys to discover flakes, runs mutation and coverage, and preserves all receipts. It does not weaken the required PR lane or authorize live writes, deployment, issue creation, or production verification.

## Scenario rules

- UX-only: MEDIUM; full gate and touched-route check; no full 79-route sweep.
- Refactor: MEDIUM only if no frozen path is touched and the full gate remains green.
- Dependencies: patch/minor may be MEDIUM; major, new, removed, or security-sensitive dependencies are HIGH.
- Secrets/config: HIGH. Never commit secret values. Log only the key name, actor, date, and decision.
- Auth/RLS: HIGH and must include or add a targeted Playwright authentication journey.
- Migration: HIGH and frozen. The PR must include exact forward, verification, and non-destructive rollback steps.
- Staging: pipeline only; build-stamp verification is mandatory.
- Production: HIGH by definition.
- Hotfix: no bypass lane. A hotfix uses a normal PR and the same required checks. If CI is unavailable, stop for a new CTO decision.
- Rollback: staging rollback to a prior immutable tag may be MEDIUM. Production or parallel-launch rollback is HIGH and redeploys a prior immutable tag; never hand-edit production.
- Release tag: HIGH; requires the full suite, full 79-route sweep, build identity proof, and a deploy-log entry.

## Labels and mechanical enforcement

- A HIGH PR must have `cto-approved` applied by `joseangelo510`.
- A PR changing this policy must also have `policy-change` applied by `joseangelo510`.
- A label from any other actor is invalid.
- `policy-guard` blocks frozen or HIGH paths without valid labels.
- `checklist-guard` validates `.github/destiny-evidence.json` and the PR's stable pointer to it.
- `harness-gates` runs the complete product harness.
- All three checks are required by branch protection. No force pushes, admin bypasses, or non-linear history.

## Evidence and completion

- MEDIUM evidence lives in the PR: run URLs, staging build stamp, and touched-route results.
- HIGH decisions, releases, production rollbacks, and secret rotations are appended to `destiny-product/DEPLOY_LOG.md`.
- Release evidence, archives, and hashes live under `docs/releases/<tag-or-decision>/`.
- A completion report must include the PR URL, merge commit SHA, and required check-run URLs.

Complete means merged with all required checks green at the merge SHA. Nothing else is complete.

Never claim a gate passed without a verifiable run URL. Never mark work complete if a required check is red, skipped, missing, or belongs to a different SHA.

## Mirrors and change control

`AGENTS.md`, `CLAUDE.md`, `.claude/skills/destiny-harness/SKILL.md`, and `docs/DESTINY_GOVERNANCE_POINTER.md` are pointers, not competing policies. If any mirror differs, this file wins.

Changing this policy is itself HIGH. It requires a new recorded Fable High decision, a `policy-change` label from Jose, the full harness, and an updated cloud pointer after merge.
