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
