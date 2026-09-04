# Destiny Harness Policy

Policy ID: `GOV-1`

Revision: `GOV-1.2` (decisions D10.8 and D10.9, 2026-09-04): Fable 5.1 participation is mandatory for every change, and owner-attributed GitHub actions may be executed by Codex only under a valid Owner Execution Authorization.

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

Fable participates at every level below the owner, but a Fable review or verdict is evidence, never authorization. Only Jose's labels and merge authorize a change. Fable may not decide changes to its own role in this file; those follow the normal policy-change path.

## Roles

- Jose owns product intent and is the sole approval authority. Only Jose may authorize the `cto-approved` and `policy-change` labels and the protected merge of a governed PR. He performs those actions personally or delegates their execution to Codex under a valid Owner Execution Authorization (OEA), defined below. Delegation transfers the click, never the decision.
- Fable means the current Fable model, Fable 5.1 at this revision. Older records that say Fable 5 refer to the same role.
- Fable 5.1 participates in every change, MEDIUM and HIGH. Before implementation it confirms the classification. Before merge it reviews the PR at its final head and issues exactly one verdict, `GO` or `HOLD`. No PR merges without a `GO` recorded at the exact PR head SHA.
- Fable 5.1 Medium reviews and advises on MEDIUM work and issues its head-level verdict.
- Fable 5.1 High is the deciding CTO authority for HIGH work and issues the head-level verdict on HIGH PRs.
- Codex coordinates and executes. Codex may not decide or self-authorize HIGH work, may not classify a change without Fable 5.1 confirmation, and may not write, edit, or reuse a Fable 5.1 verdict. Codex may execute owner-attributed GitHub actions only under a valid OEA, only the actions it names, only on the PR and head it names, and for nothing else. Any other action taken from Jose's authenticated GitHub session is a policy violation and a HIGH incident to be recorded in `destiny-product/DEPLOY_LOG.md`.
- GitHub Actions is the enforcement system of record.

## Change classification

### MEDIUM

MEDIUM is the classification when the change stays outside every HIGH and frozen surface. MEDIUM still requires Fable 5.1 participation (classification confirmation before implementation and a `GO` verdict at the PR head before merge) but requires no `cto-approved` label and no deploy-log decision:

- UI, UX, styling, copy, and accessibility;
- ordinary application features;
- refactors that preserve behavior and keep all gates green;
- test additions and non-governance documentation;
- dependency patch or minor updates that do not touch authentication, cryptography, payments, sessions, or Supabase access;
- staging verification through the existing pipeline;
- redeploying a prior immutable tag to staging.

### HIGH

Fable High must decide, the decision must be recorded in `destiny-product/DEPLOY_LOG.md` before work begins, and the PR must additionally carry a Fable 5.1 `GO` verdict at its head for:

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

The product launch at `https://app.reboundseo.com` receives production changes only from explicitly approved immutable release tags. Replit remains production of record for existing traffic until a new recorded decision says otherwise.

## Required workflow for every change

1. Branch from the canonical source. Never work directly on `main` or `container-staging`.
2. Classify the change as MEDIUM or HIGH before implementation and have Fable 5.1 confirm the classification. Record the confirmation date and the base SHA in the PR.
3. For HIGH, record the Fable High decision in `destiny-product/DEPLOY_LOG.md` before the first implementation commit.
4. Use TDD where behavior or policy changes: record RED evidence, implement GREEN, then add QA coverage.
5. Open a PR using `.github/pull_request_template.md`.
6. Pass the full `pnpm gate`, including repository policy, commit policy, deploy-log policy, migration audit, dependency audit, ESLint and English-only rules, file-length ratchet, Vitest, isolation checks, production build, and Playwright journeys.
7. Verify the staging candidate build stamp matches the PR SHA and check touched routes with zero 5xx.
8. Obtain a Fable 5.1 review of the PR at its final head SHA and paste the verbatim verdict block into the PR's `Fable 5.1 review` section, with the verdict, the reviewed head SHA, and the review date. Any push after the review invalidates it; a new review at the new head is required before merge.
9. Pass `policy-guard`, `checklist-guard`, and `harness-gates` required checks.
10. Merge through protected `main`, personally or under a valid OEA. Do not force push and do not use an admin bypass.
11. Create a release tag only under a separate HIGH decision.

## Scenario rules

- UX-only: MEDIUM; full gate and touched-route check; no full inventory-route sweep.
- Refactor: MEDIUM only if no frozen path is touched and the full gate remains green.
- Dependencies: patch/minor may be MEDIUM; major, new, removed, or security-sensitive dependencies are HIGH.
- Secrets/config: HIGH. Never commit secret values. Log only the key name, actor, date, and decision.
- Auth/RLS: HIGH and must include or add a targeted Playwright authentication journey.
- Migration: HIGH and frozen. The PR must include exact forward, verification, and non-destructive rollback steps.
- Staging: pipeline only; build-stamp verification is mandatory.
- Production: HIGH by definition.
- Hotfix: no bypass lane. A hotfix uses a normal PR and the same required checks. If CI is unavailable, stop for a new CTO decision.
- Fable unavailable: stop. There is no lane for merging without a Fable 5.1 verdict at the PR head. Unavailability, urgency, and prior conversation are not exceptions, and Codex may not act as Fable.
- Rollback: staging rollback to a prior immutable tag may be MEDIUM. Production or parallel-launch rollback is HIGH and redeploys a prior immutable tag; never hand-edit production.
- Release tag: HIGH; requires the full suite, a full sweep of every route in the committed QA inventory, build identity proof, and a deploy-log entry.

## Labels and mechanical enforcement

- A HIGH PR must have `cto-approved` applied by `joseangelo510`.
- A PR changing this policy must also have `policy-change` applied by `joseangelo510`.
- A label from any other actor is invalid. A label event by `joseangelo510` is Jose's personal act unless a valid delegation record precedes it on the PR, in which case it is a delegated execution under an OEA.
- `policy-guard` rejects a PR whose latest delegation record names a head other than the PR head, omits an owner label that is present, or whose owner label was applied before the record was posted or outside the 60-minute OEA window.
- `policy-guard` blocks frozen or HIGH paths without valid labels.
- `checklist-guard` blocks missing classification, incomplete evidence, unchecked items, or a HIGH PR without a deploy-log decision link.
- `checklist-guard` also blocks every PR whose `Fable 5.1 reviewed this PR at its current head` item is unchecked, whose verdict is not `GO`, whose `Reviewed head:` differs from the PR head SHA, or whose review date is missing, and any PR whose build-stamp evidence names a SHA other than the PR head.
- `harness-gates` runs the complete product harness.
- All three checks are required by branch protection. No force pushes, admin bypasses, or non-linear history.

## Owner Execution Authorization

An OEA delegates execution, never decision. It lets Codex apply `cto-approved`, apply `policy-change`, or press the protected merge on one PR at one head, using Jose's authenticated GitHub session, so that Jose does not have to click personally. It is the only conversational instruction this file recognizes, and only in the form below.

An OEA is valid only if all of the following hold:

1. Jose Gallegos issues it himself, as a standalone message in the live session with Codex. A reply such as "yes", "go", "approve", or "just do it" is not an OEA. Codex may quote the live PR number, head SHA, and remaining actions so Jose can copy them; Codex may not send the OEA on Jose's behalf and may not treat any Codex-drafted text as issued.
2. The message contains the literal token `OEA`, the PR number, the full 40-character head SHA, and the actions, in this form: `OEA #<pr> <40-char head>: <actions>`, where actions is a comma-separated subset of `cto-approved`, `policy-change`, and `merge`. A short SHA, a missing PR number, or a bare affirmation is invalid.
3. It names exactly one PR and exactly one head. Standing, blanket, or future authorizations are invalid.
4. It is single-use and expires 60 minutes after issuance. It is void before then if the head changes, any required check is red, missing, or belongs to another SHA, the PR has conflicts, or Jose sends any later message asking to stop, hold, or wait.
5. The PR body carries a Fable 5.1 `GO` receipt at the same head. A HIGH PR carries its deploy-log decision link. A PR that touches this file must list `policy-change` among the actions.
6. Before the first action, Codex posts a PR comment that begins `Owner execution authorization` and states `Executed by: Codex`, `Authorized by: Jose Gallegos (joseangelo510)`, the OEA text verbatim on an `OEA:` line, `Authorized at:` as an ISO-8601 UTC timestamp from the session, `Authorized head:`, and `Authorized actions:`. Labels are applied only after the comment exists, the guards must re-run green at the same head, and only then is the merge pressed.
7. After execution Codex records the outcome on the PR and in the completion report as "executed under OEA", with the label event times and the merge SHA.

Delegated execution is attributed to Jose's GitHub login; the delegation record is the audit marker, and Jose's own session transcript is the source of the OEA. Fabricating, back-dating, altering, or reusing an OEA, or acting from Jose's session without one, is a HIGH incident. A separate executor identity for delegated actions may be adopted only under a future recorded decision.

## Evidence and completion

- MEDIUM evidence lives in the PR: run URLs, staging build stamp, touched-route results, and the Fable 5.1 review receipt.
- The Fable 5.1 review receipt lives in the PR body: verdict, reviewed head SHA, review date, and the verbatim verdict text. It is evidence, not authorization.
- HIGH decisions, releases, production rollbacks, and secret rotations are appended to `destiny-product/DEPLOY_LOG.md`.
- Release evidence, archives, and hashes live under `docs/releases/<tag-or-decision>/`.
- A completion report must include the PR URL, merge commit SHA, required check-run URLs, the Fable 5.1 reviewed head SHA, and whether owner actions were personal or executed under an OEA (with the record link).

Complete means merged with all required checks green at the merge SHA. Nothing else is complete.

Never claim a gate passed without a verifiable run URL. Never mark work complete if a required check is red, skipped, missing, or belongs to a different SHA.

## Mirrors and change control

`AGENTS.md`, `CLAUDE.md`, `.claude/skills/destiny-harness/SKILL.md`, and `docs/DESTINY_GOVERNANCE_POINTER.md` are pointers, not competing policies. If any mirror differs, this file wins.

Changing this policy is itself HIGH. It requires a new recorded Fable High decision, a `policy-change` label from Jose, the full harness, and an updated cloud pointer after merge.
