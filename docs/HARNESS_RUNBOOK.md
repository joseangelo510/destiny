# Destiny Harness Runbook

The canonical rules are in root `HARNESS_POLICY.md`. This runbook explains how to apply them; it does not override them.

## Ordinary MEDIUM change

1. Update local `main` from `github/main` without rewriting local work.
2. Create `codex/<short-name>`.
3. Confirm no HIGH or frozen surface is involved, and have Fable 5.1 confirm the MEDIUM classification before implementation. Note the date and base SHA for the PR.
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
10. Ask Fable 5.1 to review the PR at its final head. Paste the verbatim verdict block into the `Fable 5.1 review` section with the verdict, reviewed head SHA, and date. Any later push requires a new review.
11. Complete the PR checklist so `checklist-guard` passes.
12. Merge only after `harness-gates`, `policy-guard`, and `checklist-guard` are green. Jose merges personally, or Codex merges under a valid OEA (see Owner-delegated execution).

## HIGH change

1. Stop before implementation.
2. Ask Fable 5 High for a binding decision with scope, allowed actions, prohibited actions, rollback, and evidence requirements.
3. Append the decision to `destiny-product/DEPLOY_LOG.md`.
4. Create the branch and PR.
5. Have Jose apply `cto-approved`, personally or through Codex under a valid OEA. Policy changes also require `policy-change`.
6. Follow every MEDIUM gate plus the decision-specific evidence.

## Owner-delegated execution

1. Codex confirms the PR head, green checks, no conflicts, and the Fable 5.1 `GO` receipt at that head, then quotes the live line for Jose: `OEA #<pr> <40-char head>: <actions>`.
2. Jose sends that line himself as a standalone message. Nothing else counts.
3. Codex posts the `Owner execution authorization` comment on the PR (Executed by, Authorized by, OEA verbatim, Authorized at, Authorized head, Authorized actions).
4. Codex applies the named labels, waits for `policy-guard` and `checklist-guard` to re-run green at the same head, then presses the protected merge if `merge` is named.
5. Codex records the outcome on the PR and in the completion report as "executed under OEA".
6. Stop immediately if the head changes, a check goes red, the 60-minute window lapses, or Jose says stop, hold, or wait.

## TDD commit discipline

- `red:` adds only a new failing test.
- `green:` adds or changes implementation, policy, or documentation without test files.
- `qa:` adds only new passing coverage.
- `test-change:` modifies an existing test and must explain why the specification changed.

Do not mix test and implementation files in one commit. Do not add skipped, focused, or todo tests.

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
- If Fable 5.1 is unavailable, stop. Nothing merges without a Fable 5.1 `GO` at the PR head.
- Staging may redeploy a prior immutable tag under MEDIUM review.
- Production or parallel-launch rollback is HIGH and redeploys the prior immutable tag. Never edit production by hand.

## Releases

A release tag is HIGH. Before tagging, require:

- a recorded Fable High decision;
- a merged PR with all required checks green at the merge SHA;
- a full sweep of every route in the committed QA inventory with zero unexpected status and zero 5xx;
- exact source, tag, container, and runtime build identity;
- a complete deploy-log entry;
- archived and hashed evidence under `docs/releases/<tag>/`.

## Governance mirror

After a merged policy change, update `docs/DESTINY_GOVERNANCE_POINTER.md` with the policy version and the commit SHA containing the unchanged canonical policy, then update the Destiny Claude Project knowledge pointer. Never paste a second full policy into the cloud.
