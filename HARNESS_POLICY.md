# Destiny Harness Policy

Policy ID: `GOV-1`
Revision: `GOV-1.3` (owner decision D10.11, 2026-09-04)
Status: active
Canonical repository: `joseangelo510/destiny`

Jose Gallegos owns product intent and approval authority. Explicit owner instructions can change this process: record their actual source in `destiny-product/DEPLOY_LOG.md` and update the policy through a protected PR. A policy cannot transfer the owner's authority to a model.

## Authority and roles

1. Jose's explicit scoped decisions, recorded with their actual source.
2. This policy at the exact working SHA.
3. GitHub Actions enforcement and protected-branch requirements.
4. Agent pointers, runbooks, and history.

Codex coordinates, implements, classifies risk, and provides technical review. It cannot invent approval or attribute its review to another person or model. Claude/Fable consultation is not required and must not be requested unless Jose explicitly asks for it again. Historical Fable records remain unchanged.

Jose is the sole approval authority for HIGH work, owner labels, protected merges, release tags, and production deployment. Execution may be delegated; delegation transfers execution, never authority.

## Classification

MEDIUM: ordinary UI/UX, accessibility, copy, features, behavior-preserving refactors, tests, non-governance docs, non-sensitive patch/minor dependencies, and pipeline staging.

HIGH: governance and enforcement; CI/deploy; authentication, OAuth, sessions, RLS, security; schema/migrations; secrets/config/credentials; major/add/remove/security-sensitive dependencies; production deployment/rollback; release tags; and ambiguity.

Record classification, base SHA, blast radius, evidence, and rollback. Record owner-authorized HIGH scope before implementation. A request authorizes only its stated or reasonably implied scope, never unrelated sensitive work.

## Frozen surfaces

Separate explicit owner authorization and a recorded plan are required for Supabase Auth Site URL changes; Replit modification/decommissioning; migrations; release-wrapper merges, deployment, or release tags; new `container-staging` pushes; Replit-to-Fly traffic redirects; auth/RLS/security changes; secrets/config changes.

Urgency is not authorization. An approved UI fix does not authorize a database migration or customer CMS publication. Production receives verified immutable release tags; never mutate tags.

## Required workflow

1. Inspect the canonical checkout and active work. Use a branch and protected PR; never directly push `main` or `container-staging`.
2. Classify risk. For HIGH, append the actual owner request, scope, limitations, rollback, and evidence requirements to `destiny-product/DEPLOY_LOG.md` before implementation.
3. Use RED/GREEN TDD and separate QA/test-change commits. Never hide failures with skip/only markers or remove tests merely to pass.
4. Run complete `pnpm gate`: repository/commit/deploy-log policies, migration/dependency audits, lint/English-only, file-length ratchet, full Vitest, tenant isolation, production build, and Playwright.
5. Verify the staging stamp equals the PR head and touched routes have zero 5xx. Do not claim a local full-gate pass without required disposable infrastructure.
6. Record technical review at the exact head: actual reviewer, GO/HOLD, SHA, date, risks, evidence. Codex may review, honestly labeled Codex; it is not owner approval. Any push invalidates the prior review.
7. Pass `harness-gates`, `staging-evidence`, `policy-guard`, and `checklist-guard`. Do not bypass, weaken, or falsely report these checks.
8. Apply required owner-authorized labels and merge only through protected controls. No force pushes, admin bypass, or branch-protection changes.
9. Release separately: verify production prerequisites, immutable source/tag/image/runtime identity, full route inventory, rollback point, deployment outcome, and live user journeys.

## Owner Execution Authorization

Jose may approve in ordinary language; he need not type a special token or hash. A clear request to fix authorizes preparation and normal implementation in scope. Approval to merge or deploy authorizes only the identified change/release. Clarify genuinely ambiguous targets or scope.

Before delegated owner-attributed GitHub actions:
- Verify the account is `joseangelo510` and resolve the approved scope to the exact PR/current full head.
- Post an `Owner execution authorization` comment through that account with `Executed by: Codex`, `Authorized by: Jose Gallegos (joseangelo510)`, verbatim `Owner request`, `Authorization source` identifying the task/message, `Authorized PR`, `Authorized head`, and `Authorized actions`.
- Include only approved actions from `cto-approved`, `policy-change`, and `merge`. Apply labels after the record exists; wait for same-head green guards before merging.
- Report outcomes as delegated execution; never imply Jose clicked personally.

Authorization ends when Jose says stop/hold/wait, scope materially changes, or the action completes. A head change requires renewed verification and a new record; material changes require renewed approval. Never fabricate, backdate, or broaden authorization.

Existing strict `OEA #<pr> <40-char head>: <actions>` records remain supported under their original single-use, exact-head, 60-minute terms. Plain-language authorization is a distinct transparent record, not a fabricated OEA.

## Mechanical enforcement

HIGH requires `cto-approved` applied by `joseangelo510`; policy changes additionally require `policy-change` from that account. Delegation records must come from that account, identify owner evidence, match PR/head, cover labels, and predate label actions.

Checklist enforcement requires classification, test and staging evidence, recorded HIGH decisions, and an exact-head GO technical review with the actual reviewer named. Missing, failing, stale, or skipped checks prevent merge. CI unavailability is not a bypass lane. Preserve isolation, security, dependency, migration, build, and release safeguards.

## Evidence and completion

Never claim a gate passed without a verifiable run URL.
Complete means merged with all required checks green at the merge SHA. A deployed outcome additionally requires verified live identity and user-facing checks; merged does not mean deployed.

Report PR URL, merge SHA, check URLs, reviewed head, and owner execution record. Releases also report tag, image, deployment run, live proof, and rollback point. Preserve historical decisions and incidents append-only.

Rollback uses a protected revert or explicitly approved prior immutable release. Never hand-edit production, delete user data, or mutate tags.

## Mirrors

`AGENTS.md`, `CLAUDE.md`, `.claude/skills/destiny-harness/SKILL.md`, and governance docs are pointers to this policy. No Claude cloud consultation or pointer update is required. Governance changes remain HIGH with owner labels and complete checks.
