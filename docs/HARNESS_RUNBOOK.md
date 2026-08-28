# Destiny Harness Runbook

The canonical rules are in root `HARNESS_POLICY.md`. This runbook explains how to apply them; it does not override them.

## Ordinary MEDIUM change

1. Update local `main` from `github/main` without rewriting local work.
2. Create `codex/<short-name>`.
3. Confirm no HIGH or frozen surface is involved.
4. Write a RED test when behavior changes and keep RED, GREEN, and QA commits separate.
5. From `destiny-product/`, run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm gate
   ```

6. Push the branch and open a PR with `.github/pull_request_template.md`.
7. Wait for `harness-gates`. Add its GitHub Actions URL to the Vitest, ESLint, and Playwright evidence fields.
8. Verify the build-stamp evidence matches the PR head SHA.
9. Check touched routes on the staging candidate with zero 5xx and record the results.
10. Complete the PR checklist so `checklist-guard` passes.
11. Merge only after `harness-gates`, `policy-guard`, and `checklist-guard` are green.

## HIGH change

1. Stop before implementation.
2. Ask Fable 5 High for a binding decision with scope, allowed actions, prohibited actions, rollback, and evidence requirements.
3. Append the decision to `destiny-product/DEPLOY_LOG.md`.
4. Create the branch and PR.
5. Have Jose apply `cto-approved`. Policy changes also require `policy-change`.
6. Follow every MEDIUM gate plus the decision-specific evidence.

## TDD commit discipline

- `red:` adds only a new failing test.
- `green:` adds or changes implementation, policy, or documentation without test files.
- `qa:` adds only new passing coverage.
- `test-change:` modifies an existing test and must explain why the specification changed.

Do not mix test and implementation files in one commit. Do not add skipped, focused, or todo tests.

## Harness v2 operating loop

1. Update `.github/destiny-evidence.json` so its classification, decision link, network mode, routes, and `productPaths` match the actual branch diff.
2. For each behavioral or policy cycle, declare the ancestor RED commit, focused argv command, expected failure text, test files, and implementation paths. The replay must collect tests, fail for that reason at RED, and pass at HEAD.
3. Run `pnpm qa:harness-v2` from `destiny-product/`. This records portable environment capabilities, runs typed evidence and every RED replay, architecture and debt fitness functions, enforces the current cyclomatic-complexity ratchet of 19 on every changed executable function, measures changed-line and changed-branch coverage, then runs capped changed-scope mutation testing. Type-only refactors do not consume executable mutation or complexity scope.
4. Inspect `qa/artifacts/harness/summary.json`, `trace.jsonl`, and `capabilities/capabilities.json`. The summary binds the exact SHA to a deterministic hash of the component receipts. Traces are versioned, correlated, and recursively redact secrets.
5. Never rerun a failed test to make the gate green. Playwright retries are zero. A fail-then-pass discovered by repeated nightly execution remains a failure and must be fixed or placed in an owned, expiring quarantine.
6. Do not lower a ratchet to pass a PR. Debt metrics may hold or improve; changed coverage, mutation, and journey proof may hold or improve. Runtime is a ceiling, and raw test count is informational.

The current locked floors are 100% changed-line coverage, 91% changed-branch coverage, 69% changed mutation, 100% API contract coverage, 100% browser journey coverage, and 100% combined route proof. Duplication may not exceed 3.01%. `qa/harness/baseline.v2.json` is authoritative and records each ratchet movement with its receipt.

Useful focused commands:

```bash
pnpm qa:evidence
pnpm qa:capabilities
pnpm qa:quality
pnpm qa:coverage
pnpm qa:mutation
pnpm qa:harness-v2
```

`pnpm gate` first runs `qa:capabilities:required`. Its Supabase and authenticated-browser lanes require a responsive Docker- or Podman-compatible engine. When that infrastructure is missing, the gate fails immediately and preserves a separate `capabilities/required-capabilities.json` receipt without overwriting the portable-lane receipt.

The default network mode is `mocked`. Local integration tests must explicitly use `local-isolated`; staging is read-only; authorized live access requires the separate live authorization gate and is never implied by a test command.

## Staging evidence

The harness workflow records:

- exact PR SHA;
- full gate outcome;
- successful production build;
- Playwright route/journey outcome;
- a reusable evidence artifact.

The PR must identify the routes changed and the observed staging status for each. A 5xx is a hard stop.

## Hotfixes and rollbacks

- There is no bypass lane for a hotfix.
- If CI is unavailable, stop and obtain a new Fable High decision.
- Staging may redeploy a prior immutable tag under MEDIUM review.
- Production or parallel-launch rollback is HIGH and redeploys the prior immutable tag. Never edit production by hand.

## Releases

A release tag is HIGH. Before tagging, require:

- a recorded Fable High decision;
- a merged PR with all required checks green at the merge SHA;
- the full 79-route sweep with zero unexpected status and zero 5xx;
- exact source, tag, container, and runtime build identity;
- a complete deploy-log entry;
- archived and hashed evidence under `docs/releases/<tag>/`.

## Governance mirror

After a merged policy change, update `docs/DESTINY_GOVERNANCE_POINTER.md` with the policy version and the commit SHA containing the unchanged canonical policy, then update the Destiny Claude Project knowledge pointer. Never paste a second full policy into the cloud.
