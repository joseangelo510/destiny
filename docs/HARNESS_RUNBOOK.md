# Destiny Harness Runbook

Follow root `HARNESS_POLICY.md`, GOV-1.3. Owner decision D10.11 removes mandatory Claude/Fable consultation, preserving owner authority and verification.

1. Verify the canonical checkout, SHA, active work, and owner scope.
2. Create a `codex/` branch. Classify risk; record owner-authorized HIGH scope, limits, evidence, and rollback in DEPLOY_LOG before implementation.
3. Separate commits: `red:` new failing tests, `green:` implementation/docs, `qa:` new passing tests, `test-change:` justified existing-test changes.
4. Run `pnpm gate` from `destiny-product`. Do not claim local full success without required disposable infrastructure.
5. Open a protected PR. Verify harness, staging stamp, touched routes with zero 5xx, and isolation.
6. Record technical review with actual reviewer, GO/HOLD, date, and exact head. A changed head invalidates review. Codex may review; it is not owner approval.
7. Verify GitHub identity and owner scope; post the canonical owner execution record with actual words and source before delegated labels/merge. Jose need not type a machine token. HIGH requires cto-approved; policy also requires policy-change.
8. Merge only with all required checks green. Record delegated outcomes honestly.

Merging is not deployment. Release separately after checking production prerequisites, including unapplied migrations. Use an approved immutable tag and guarded workflow. Verify source/tag/image/runtime identity, machine health, full routes, zero 5xx, and signed-in journeys; record rollback evidence.

No direct main/container-staging pushes, force pushes, admin bypass, skipped checks, mutable tags, or hand-edited production. Stop/hold/wait cancels execution. CI unavailability blocks release. Do not infer CMS writes, emails, migrations, or deployment from narrower authorization. Do not involve Claude unless Jose explicitly requests it.

## CI readiness maintenance (D10.22, 2026-09-05)

Run `pnpm qa:pr-preflight` before pushing; inspect and commit any regenerated QA inventory as a separate implementation change. Before submitting final PR evidence, run `pnpm qa:pr-preflight --body-file /absolute/path/to/pr.md`. It checks format and the exact local head, not remote approval or run results.

The required policy/checklist checks are published separately from their evaluator jobs. `in_progress` means merge is blocked awaiting evidence, review, readiness or approval. A successful evaluator job only means it refreshed the check; inspect the required `policy-guard` and `checklist-guard` themselves. Invalid authority and API/operational errors still fail. Full harness and staging failures retain normal GitHub alerts.

Automatic evaluators execute trusted default-branch code, read current PR metadata twice and serialize refreshes. New heads cannot reuse older evidence. Successful checklist evidence must link the latest successful current-head PR harness and staging runs. Staging rebuilds on open, synchronize or reopen; body edits refresh the checklist without rebuilding code.

A maintainer may explicitly dispatch either existing guard workflow with a PR number to prioritize a stuck check. Every refresh reconciles all open PRs because GitHub coalesces pending concurrency events. Manual dispatch executes the selected workflow revision (GitHub `github.sha`) so a reviewed maintenance candidate can be tested before first activation; always verify the selected repository, branch and full SHA. Automatic events never check out PR code with write permission. No code from artifacts is executed. No ruleset or notification setting changes are part of D10.22.

Activation requires protected merge and a live readback of the same named GitHub Actions checks (integration 15368). A local test pass is not activation. The current ruleset requires harness-gates, policy-guard and checklist-guard; checklist additionally enforces the written staging requirement. Do not use admin bypass if migration checks are unavailable.
