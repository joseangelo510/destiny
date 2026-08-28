# Destiny Deploy Log

No release is valid unless its entry is complete and the green gate belongs to the exact shipped SHA. A release entry containing `TBD`, `pending`, or an empty field is a hard stop.

## Required release-entry template

Copy this commented template for each release. Remove the comment markers only after every field has verified evidence.

```text
## Release: <name>
- date: <ISO date and time>
- shipped commit SHA: <full SHA>
- tag: <immutable tag>
- PR links: <one or more URLs>
- gate run link: <green run URL for shipped SHA>
- summary counts: <test files, tests, browser journeys>
- RED evidence links: <one failing run per new RED test group>
- commit discipline: <pass and policy version>
- isolation matrix: <pass and fixture summary>
- test-change: <none, or commit plus justification>
- migrations: <IDs, or explicit none>
- features and blast radius: <feature map names and blast radius>
- rollback command: <exact non-destructive rollback command>
- deployer: <person or automation>
- post-deploy smoke: <run URL and result>
- legacy-evidence: <pre-policy TDD pairs and GitHub runs; required for PR #7 only>
```

## Pre-release Step Zero evidence

- Draft PR: https://github.com/joseangelo510/destiny/pull/7
- Last fully green pre-policy gate: https://github.com/joseangelo510/destiny/actions/runs/32560700136
- Pre-policy counts: 155 Vitest files, 1,064 tests, 10 authenticated/public desktop and mobile browser journeys
- Status: evidence only; this is not a shipped release entry

## CTO governance decision: GOV-1

- date: 2026-08-23
- deciding authority: Fable 5 High, acting as Destiny CTO at Jose Gallegos's direction
- decision record: https://claude.ai/chat/1eed0b57-2045-4cdc-a738-df1c67dcdbdc
- scope: authorize implementation of the durable Destiny harness-governance system on a protected branch and PR
- decision: create one canonical root `HARNESS_POLICY.md`; add thin root `AGENTS.md` and `CLAUDE.md` pointers; add the `destiny-harness` project skill and cloud knowledge pointer; enforce classification, frozen paths, evidence, and completion rules in GitHub Actions; validate the GOV-1 test matrix before claiming completion
- frozen actions retained: no Supabase Auth Site URL change, Replit modification or decommissioning, database migration, wrapper merge to `main`, or new `container-staging` push without a new recorded Fable 5 High decision
- implementation branch: `codex/destiny-governance-gov-1`
- production effect: none authorized; governance implementation only

## CTO governance decision: D-SQUASH-EXEMPT-1

- date: 2026-08-23
- deciding authority: Fable 5 High, acting as Destiny CTO at Jose Gallegos's direction
- triggering evidence: post-merge `main` harness https://github.com/joseangelo510/destiny/actions/runs/32651315235 failed at merge SHA `2c62a5b364385565d484935ab4b76679779a4c12` because GitHub's protected squash subject did not use a TDD commit prefix
- classification: HIGH enforcement-script repair under GOV-1
- binding rule: commit-shape and TDD-prefix validation applies only to commits that are not reachable from the protected remote `origin/main`; commits already reachable from protected `origin/main` are exempt because their constituent PR commits were checked before squash merge
- fail-closed rule: the gate must fail with a clear error if `origin/main` cannot be resolved; no subject-pattern allowlist or GitHub API dependency is permitted
- invariant rules: forbidden-test-marker scanning, `commit-policy.json` immutability, activation checks, and strict validation for commits outside protected `origin/main` remain unchanged
- authorized files: `destiny-product/scripts/qa-commit-policy.mjs`, a focused commit-policy test file, this deploy-log entry, and only if required a minimal workflow fetch-depth or `origin/main` ref fix
- forbidden shortcuts: no history rewrite, force push, admin bypass, branch-protection weakening, `commit-policy.json` edit, soft-failed gate, or `HARNESS_POLICY.md` edit
- required sequence: decision record, RED tests, GREEN implementation, protected HIGH PR with `cto-approved`, all three required checks, protected squash merge, and a green post-merge `main` harness at the repair merge SHA
- rollback: revert-by-PR through the same protected path; no direct edit, tag, production change, or history rewrite

## CTO governance decision: D-SQUASH-EXEMPT-2

- date: 2026-08-23
- deciding authority: Fable 5 High, acting as Destiny CTO at Jose Gallegos's direction
- classification: HIGH enforcement-script amendment to D-SQUASH-EXEMPT-1
- triggering evidence: the canonical local clone uses `github/main` for `git@github.com:joseangelo510/destiny.git`, while its non-canonical local `origin` has no `origin/main`; a remote-name-only rule failed closed locally and could trust a spoofed `origin` later
- binding rule: select only `origin` or `github`, in that order, and only when its normalized URL exactly identifies `joseangelo510/destiny` and its full `refs/remotes/<name>/main` ref resolves
- accepted canonical URL identities: HTTPS, SCP-style SSH, or `ssh://` forms for `github.com/joseangelo510/destiny`, with at most one trailing slash and one optional `.git` suffix removed before exact comparison
- fail-closed rule: if neither candidate has both canonical URL identity and a remote-tracking `main` ref, stop with diagnostics for both candidates; never trust a remote name, local branch, `HEAD`, network lookup, regex substring, or configuration override
- required evidence: offline temporary-repository tests for CI and canonical-clone layouts, spoofed remotes, absent refs, URL normalization and near misses, local-branch spoofing, no-network operation, plus the D-SQUASH-EXEMPT-1 reachability regressions
- authorized files: `destiny-product/scripts/qa-commit-policy.mjs`, focused commit-policy tests, and this deploy-log entry only
- completion and rollback: retain every protected PR, `cto-approved`, three-check, post-merge `main` harness, and revert-by-PR requirement from D-SQUASH-EXEMPT-1

## CTO governance decision: D-HARNESS-PHASE-COMPLETE-1

- date: 2026-08-23
- deciding authority: Fable 5 High, acting as Destiny CTO at Jose Gallegos's direction
- classification: HIGH governance stage-gate under GOV-1
- verified evidence: active ruleset `Destiny protected main` at https://github.com/joseangelo510/destiny/settings/rules/21242085 has no bypass actors and requires `harness-gates`, `policy-guard`, and `checklist-guard`; protected repair PR https://github.com/joseangelo510/destiny/pull/10 merged at `932425eff975e30b5652828c2baef8cc35103030`; the exact-SHA post-merge harness passed at https://github.com/joseangelo510/destiny/actions/runs/32652674102
- decision: GO; the harness phase is complete at `932425eff975e30b5652828c2baef8cc35103030`, and MEDIUM product work is authorized under GOV-1
- mandatory product lane: UX, copy, ordinary features, safe refactors, tests, and non-governance documentation must continue through branch, classification, full `pnpm gate`, protected PR, and the three required checks; ambiguity still defaults to HIGH
- ongoing non-blocking harness work: monitor gate runtime and flakiness, add Playwright coverage with each feature, periodically check GitHub rules and workflow-policy drift, keep patch and minor dependencies current through the MEDIUM lane, and record newly observed edge cases rather than speculatively delaying product work
- next product priorities: improve the core journey from sign-in to first delivered value; ship one evidence-led flagship feature end to end with its Playwright journey; prepare `app.caminoseo.com` launch readiness without performing the frozen cutover
- frozen actions retained: no Supabase Auth Site URL change, Replit production modification or decommissioning, database migration, release-wrapper merge, new `container-staging` push, traffic redirect, auth or RLS change, release tag, or production or parallel-launch change without a new recorded Fable 5 High decision
- implementation scope: this deploy-log decision record only; no product, customer-data, staging, or production mutation is authorized
- completion and rollback: merge this record through a protected HIGH PR with `cto-approved`, all three required checks, and a green post-merge `main` harness; rollback only by protected revert PR

## CTO product decision: D-MVP-CERTIFICATION-1

- date: 2026-08-23
- deciding authority: Fable 5 High, acting as Destiny CTO at Jose Gallegos's direction; Jose approved proceeding after reviewing the 20-feature MVP implementation audit
- decision record: https://claude.ai/chat/96ea1beb-bf62-49f8-88b7-6596cb98cbfa
- classification: HIGH product-certification program under GOV-1 because the approved scope includes Google OAuth property binding and Supabase-backed publication state
- decision: stop expanding the MVP feature set and certify one narrow WordPress vertical slice in this order: enforce the keyword-quality gate; establish one canonical publication receipt; prove reviewed article delivery to a WordPress draft and later live verification; restrict This Week to certified actions; reconcile the in-app weekly report to rank observations; and make Google Search Console and Analytics property selection explicit, site-bound, and fail closed
- authorized implementation: TDD changes to ordinary product code, tests, Playwright journeys, Google sync/property-selection logic, and existing Supabase-backed integration/publication records needed for the certified slice; the implementation must reuse the current schema and current OAuth scopes, store no secret values, and preserve organization and website isolation
- authorized external verification: existing staging pipeline and non-production controlled test properties/sites only; no customer production publish, email send, social post, billing change, or public traffic change is authorized by this record
- frozen actions not authorized: no database migration, Supabase Auth Site URL change, auth/RLS/security-model change, secret or provider-credential mutation, Replit production change, `container-staging` push outside the existing pipeline, traffic redirect, production or parallel-launch deploy, release-wrapper merge, or release-tag creation
- implementation branch: `codex/destiny-mvp-certification-v1`, branched from protected `github/main` merge SHA `d69f072262730d2cc976825155f8cf3b88524a4a`
- mandatory evidence: separate RED and GREEN commits; full `pnpm gate`; exact-SHA staging build stamp; zero-5xx checks for touched routes; two-property Google isolation proof; one WordPress Draft Delivered to Live Verified journey; adversarial keyword-quality corpus; and required `policy-guard`, `checklist-guard`, and `harness-gates` checks
- pull-request control: the HIGH PR requires the `cto-approved` label applied by `joseangelo510`; no actor may substitute for Jose or weaken this requirement
- completion rule: this program is not complete until the protected PR is merged, all required checks are green for the merge SHA, and the completion report contains the PR URL, merge SHA, and check-run URLs
- rollback: protected revert PR only; no direct production edit, history rewrite, migration rollback, tag mutation, or admin bypass

## CTO product decision: D-MVP-CERTIFICATION-2

2026-08-24 | D-MVP-CERTIFICATION-2 | HIGH | CONDITIONAL GO | Issued by: Fable 5 High (Destiny CTO, HARNESS_POLICY.md GOV-1)
Scope: Live end-to-end certification on production customer properties joseangelostudios.com and clearcheck.app.
Canonical build: main @ 8e2100323196c9cf0145ef78824294213df169ba (PR #12). Post-merge harness green: https://github.com/joseangelo510/destiny/actions/runs/32698351937
Extends: D-MVP-CERTIFICATION-1 (non-production only). Does not revoke it.
Authorized: onboarding; GSC + GA connection; keyword strategy; keyword add/remove/approve/decline; editorial calendar; content generation + expert review to DRAFT only; CMS draft delivery; ONE immediate publish of a pre-existing approved post per site; ONE scheduled publish of a pre-existing approved post per site at approximately +60 min; schedule execution verification; social share of verified live URL to connected LinkedIn and X per site; site-bound receipt verification; cross-site isolation verification.
Not authorized: publishing any content generated today; email sends; Fly production deploy; code/migration/RLS/secret/tag/billing/redirect changes; any action on clearcheck.app production or client social accounts without written client authorization on file (section 3 condition C1).
Runtime environment executing test: [RECORD: instance URL, env name, running SHA, operator account] (preflight P1, must equal 8e21003).
Stop conditions: section 7 of decision record. Rollback owner: Jose. Evidence ledger: [RECORD: path].
Status: OPEN. Close with PASS / PASS-WITH-EXCEPTIONS / FAIL and evidence ledger link.

## CTO governance decision: D-MVP-RECOVERY-1

[2026-08-24] D-MVP-RECOVERY-1
Status: P1 HARD NO GO. Certification OPEN. Production UNVERIFIED.
Canonical main: 8e2100323196c9cf0145ef78824294213df169ba (tree e3baafcd2300c5bde18ccabbf5c6ab3a23b642a7)
Harness: https://github.com/joseangelo510/destiny/actions/runs/32698351937
Live: https://destiny-seo.replit.app, Replit VM deployment a5e94a27-6ca6-4f32-a8a7-08e671bf965d, runtime SHA not exposed
Replit workspace: codex/interviews-feature @ db1a17adccad9f2a29d3241146fc4f65651a0dcf (tree c492deeec56cbe82aca6b9bbcda573dbb8dcfeb7), merge base 28d184fd, ahead 1 behind 63
Rollback reference: tag rollback/pre-recovery-1 = db1a17ad, deployment a5e94a27
Mutations: none. Publish/schedule/social: halted.
Next: PR A (gov/recovery-1) version endpoint + preflight; then detached checkout of new main in Replit; redeploy a5e94a27 in place; verify /api/version.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1

## CTO governance decision: D-MVP-RECOVERY-1B

[2026-08-24] D-MVP-RECOVERY-1B
Second gate amendment to D-MVP-RECOVERY-1. PR #13, head a95058fac3d1bc6dbbbc0770de49268f8cbf50ac before amendment.
Gate at a95058f: repo policy, commit policy, deploy log policy, inventory, migrations, dependency audit, lint passed. Vitest failed.
Failure 1: route-auth-census rejected src/app/api/version/route.ts. Decision: GO, path 13 authorized, one allowlist entry with written justification, no logic change.
Failure 2: two commit-policy-canonical-main-ref tests timed out at 5s, no assertion failure. Decision: no file change, one unchanged rerun, CI harness authoritative, halt if repeated.
Sequence: PR body amended to 13 paths, test-change: commit (census test only), green: commit (decision + log only), full gate once, CI run.
Mutations: none. Publish/schedule/social: still halted. P1 still NO GO until deploy and /api/version verification.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1

## CTO governance decision: D-MVP-RECOVERY-1A

[2026-08-24] D-MVP-RECOVERY-1A
Scope amendment to D-MVP-RECOVERY-1. PR #13.
RED: 030b646 (failed correctly, /api/version absent). GREEN: 4181bed (four focused tests pass).
Gate: qa:inventory regenerated destiny-product/qa/inventory/routes.json (+5 lines, /api/version registration). No other changes.
Decision: path 12 authorized, generated only, new commit after 4181bed, PR description amended before commit.
Mutations: none. Publish/schedule/social: still halted. P1 still NO GO until deploy and /api/version verification.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1

## CTO governance decision: D-MVP-RECOVERY-1D

[2026-08-24] D-MVP-RECOVERY-1D
Classification: HIGH (CI/deployment workflow change under GOV-1). Decision: GO for a disposable CI-ephemeral staging-evidence pipeline; no other route.
Trigger: PR #14 (gov/recovery-1c, head 04b8815a1d3e92c58b27d20bb5dbfff67d6aa223, exact-diff approved, policy-guard and harness-gates green) is blocked only by checklist-guard staging evidence. Repository inspection found no staging workflow on main; the sole remote container-staging branch is an orphan production parallel-launch wrapper at 84dc942 pinned to release step-zero-v1.1 / fc7f050, Fly app destiny-production, app.caminoseo.com, and production Supabase. It is not a staging pipeline. A new container-staging push is frozen action 5 and remains forbidden. Waiving the checklist item cannot work: checklist-guard mechanically requires the checked staging lines, and checking them without a real staging verification would be false evidence. Both are rejected.
Definitional clarification (authority order 1): until a durable staging environment is separately authorized, the staging pipeline of record for checklist evidence is a CI-ephemeral staging candidate: the exact PR head SHA checked out, production build executed (stamp writer invoked), booted in the GitHub Actions runner, build stamp read from the built artifact and, where exposed, GET /api/version, then touched routes probed with statuses recorded and zero 5xx asserted. The stamp value must be derived from git rev-parse HEAD in the runner and must equal the pull_request head SHA; any mismatch fails the run.
Authorized paths (exact, no expansion): .github/workflows/staging-evidence.yml (new); destiny-product/scripts/staging-evidence.mjs (new); destiny-product/qa/rules/staging-evidence-policy.test.ts (new); destiny-product/DEPLOY_LOG.md (this record only); .github/pull_request_template.md and PR body edits are NOT code paths and are not modified.
Constraints: the workflow deploys nowhere external, uses no secrets beyond the default GITHUB_TOKEN, pushes no branch, and is not added to branch protection by this decision. It runs on pull_request [opened, synchronize, reopened, edited]. Jose may later make it a required check by a separate decision.
Sequence: PR #15 from main d0c302cf1d0e52207b9154b37ec8728ea6d792fc: (1) decision-record commit appending this entry; (2) red: commit adding the failing qa rule test; (3) green: commit adding workflow and script. PR #15 is HIGH, requires cto-approved by joseangelo510, full gate, and its own staging-evidence run URL as checklist evidence. After PR #15 merges, PR #14 stays open at head 04b8815 unchanged; its body is edited to check the two staging boxes with the staging-evidence run URL, the full 40-character head SHA, and the touched-route status list stating zero 5xx.
Not authorized: customer data access, publishing, scheduling, social, email, production or parallel-launch deploy or cutover, release tag, migration, secret or credential mutation, auth/RLS/security-model change, Supabase Auth Site URL change, container-staging push, traffic redirect, and any Replit modification. Replit remains production of record, untouched.
Mutations: none by this record. Publish/schedule/social: halted. P1 remains NO GO per D-MVP-RECOVERY-1C.
Decided by: Fable 5 High, Destiny CTO under HARNESS_POLICY.md GOV-1

## CTO governance decision: D-MVP-RECOVERY-1C

[2026-08-24] D-MVP-RECOVERY-1C
Classification: HIGH. Decision: GO for the exact seven paths recorded in `docs/releases/D-MVP-RECOVERY-1/FABLE_HIGH_DECISION.md`; no expansion.
Trigger: Republish of deployment a5e94a27 initiated at T0 2026-08-24T19:03:27Z from detached M2 `d0c302cf1d0e52207b9154b37ec8728ea6d792fc`, tree `28daab7097aa56dcbe50e42389a8142b8b1937cd`, with clean status.
Classification: LIVE, UNPROVEN, M2 BY RECEIPT. Replit publish status reports success, but no build record later than T0 appears in deployment history and unauthenticated `GET /api/version` returns `401`.
Publish record: Replit publish commit `961bca1eec332a43a617aadb2e9b4246f73c8218` (parent M2, tree `28daab7097aa56dcbe50e42389a8142b8b1937cd`, 2026-08-24T19:21:17Z), preserved by local-only tag `receipt/replit-publish-961bca1`. Publish status API: success, deployment a5e94a27. Build record after T0: none observed.
Environment drift: `qgit` was added to ignored, untracked `replit.nix` through a Replit Nix prompt during pager recovery. No tracked repository content changed; the file was not reverted; no deployment impact is expected.
Required change: make the build stamp an explicit part of `build`, emit deterministic provenance evidence, and expose exact GET-only `/api/version` before authentication while keeping every other protected API and method blocked.
RED evidence: commits `0d2db17` and `702bf93` failed exactly because `build` did not invoke the stamp writer and unauthenticated `GET /api/version` returned `401`; the remaining focused proxy tests passed.
Mutations: none. Publish/schedule/social: halted. P1 remains NO GO until the future M3 deployment has a post-trigger build log with matching runtime provenance.
Decided by: Fable 5 High, Destiny CTO under HARNESS_POLICY.md GOV-1

## CTO governance decision: D-MVP-RECOVERY-1E

[2026-08-24] D-MVP-RECOVERY-1E
Trigger: PR #14 (approved head 04b8815) became unmergeable after PR #15 [D-MVP-RECOVERY-1D] merged at b6caa00; sole conflict destiny-product/DEPLOY_LOG.md, append only.
Decision: PR #14 retained unchanged and closed as superseded; implementation re carried by cherry-pick onto b6caa00 in gov/recovery-1c-r2; the five implementation paths are byte identical to PR #14; DEPLOY_LOG resolved by appending 1C then 1E after main's content. Merge commit route rejected (unclassifiable under commit policy).
Mutations: none. Replit/production/publish/schedule/social: untouched.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1

## D-MVP-M3-DEPLOY-1 — 2026-08-26

Authority: Fable High (CTO decision), explicitly requested by Jose for launch certification.
Decision: GO — one-time scoped lift of production freeze.
Scope: Align Replit workspace from detached `961bca1` (tree `28daab`) to exact M3
  commit `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa`
  tree   `235f628315cbfb58f55766456985828557d798e6`
  and republish existing deployment `a5e94a27` in place. NO other changes:
  no new commits, no env/secret/domain changes, no new deployments.
Checks basis: green post-merge harness run `32776255636` / job `97587896513` on `origin/main`.
Proof required (P1): `/api/version` stamp == exact commit+tree above (public or
  authenticated read), plus 15-min zero-5xx window. Evidence appended below on completion.
Rollback: republish `961bca1` snapshot (`a5e94a27` known-good); freeze re-engages.
Effect on prior decisions: on P1 pass, `D-MVP-RECOVERY-1..1E` live halt lifts for this
  runtime only; `D-MVP-CERTIFICATION-2` narrow tests activate (`joseangelostudios.com`
  first; `clearcheck.app` only with client authorization recorded here; no
  generated-today content).
Status: AUTHORIZED — awaiting execution + P1 evidence.

## CTO product decision: DEC-2026-08-27-SEO-RESEARCH-REDEPLOY

- date: 2026-08-27
- deciding authority: Fable 5 High, acting as Destiny CTO under `HARNESS_POLICY.md` policy `GOV-1`
- parent decision: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY`
- amendment: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A1`
- decision record: https://claude.ai/chat/bbdba982-9e3a-4b70-957c-6e61752fc275
- classification: HIGH production single-function redeploy
- decision: CONDITIONAL GO on Route B; the existing `keywords` response enrichment is accepted
- status: AUTHORIZED PENDING; this entry and its evidence packet authorize the protected decision-record PR, not an immediate deploy
- authorized source commit SHA: `450ae943fde32ad479692a851e09bc6d58a27944`
- authorized source repository tree: `2ec2f8919700c7ff7a1fae13d55f99970f45cf1d`
- authorized `seo-research` function tree: `903ecae5e0d868f1390fe2128733f71113f13101`
- target: Supabase project `etkksjebqgtkkdqznnxa`, function `seo-research`, function ID `6b6d5160-7376-4e8b-8081-900d637a1aec`
- current production: version `12`, JWT verification `true`, package SHA-256 `e9e8bea879002b80be9c30e26e9b92754a8f2e61cb784ead2ce7d44840aa4f37`
- shipped commit SHA: pending; no deployment has occurred
- tag: none authorized
- PR links: pending protected docs-only HIGH PR
- gate run link: pending exact PR-SHA required checks; local gate passed every pre-container stage and then stopped at Supabase local start because Docker and Podman are unavailable
- summary counts: transient Deno check `1/1` pass; focused Vitest `11/11` pass; full local Vitest `177/177` files and `1,159/1,159` tests pass; last-24-hour production sample `2/2` HTTP 200; production smokes `0/5` until the post-merge deployment gate
- RED evidence links: not applicable to this docs-only decision record; the accepted product implementation already exists on protected main and focused behavior evidence is recorded under `docs/releases/DEC-2026-08-27-SEO-RESEARCH-REDEPLOY/PREFLIGHT_EVIDENCE.md`
- commit discipline: this decision record uses one `green:` non-test commit; no product, test, config, dependency, or lockfile change is included
- isolation matrix: future smoke uses a Jose-owned domain only; no customer write, database mutation, CMS publish, email, or social action is authorized
- test-change: none; no test file is changed by the decision-record PR
- migrations: none authorized or applied
- features and blast radius: one existing Edge Function; keyword-mode requests may add one depth-10 live SERP call and the new `keyword_serp` kind adds one depth-10 live SERP call; old kinds must remain healthy
- provider evidence: DataForSEO balance `$42.129398`; available seven-day spend `$1.3700`; live 10-result SERP price `$0.002`; observed incremental upper bound `$0.004/day`
- absolute cost guardrails: escalate above `$5` added rolling-24-hour spend or equivalent balance drift; roll back above `$10`; details and latency, 5xx, response-shape, and UI guardrails are in the linked evidence packet
- rollback artifact: `docs/releases/DEC-2026-08-27-SEO-RESEARCH-REDEPLOY/rollback-v12/`; source manifest and production package SHA are separate identities
- rollback command: no blind command is authorized; verify the manifest, deploy the captured version-12 source as a new function version with JWT verification retained, confirm active state, then smoke the four old kinds
- deployer: Codex may execute only after this record merges and every post-merge pre-deploy gate in the Fable decision passes; Jose remains rollback owner and sole `cto-approved` label authority
- post-deploy smoke: pending all five kinds (`keywords`, `keyword_serp`, `backlinks`, `creators`, `article_evidence`) plus Jose-owned live UI; required immediately after any future deploy
- observation: continuous 60-minute watch, then 6-hour, 24-hour, and 72-hour checks
- legacy-evidence: production provenance substitute and known `/api/version` `401` gap are recorded in `docs/releases/DEC-2026-08-27-SEO-RESEARCH-REDEPLOY/FABLE_HIGH_DECISION.md`
- forbidden scope: no schema or migration, auth or RLS change, credential or environment mutation, release tag, Replit change, traffic redirect, CMS publish, email, social post, or other production surface

## CTO production hold decision: DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A2

- date: 2026-08-27
- deciding authority: Fable 5 High, acting as Destiny CTO under `HARNESS_POLICY.md` policy `GOV-1`
- decision record: https://claude.ai/chat/bbdba982-9e3a-4b70-957c-6e61752fc275
- parent decision: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A1`
- classification: HIGH production observation and hold decision
- observed deployment: Supabase `seo-research` version `13`, active with JWT verification retained, deployed from authorized source commit `450ae943fde32ad479692a851e09bc6d58a27944`
- decision: HOLD version 13 active; NO ROLLBACK; NO REPLIT REPUBLISH under this decision
- evidence basis: three version-13 Edge calls returned HTTP 200 in 992–4,730 ms; the authenticated live application rendered existing keyword and backlink responses without parser or render failure; no 5xx, timeout, or cost ceiling fired
- application correction: the current Replit frontend predates the merged first-page route; the same-origin app POST returned a pre-existing 404 and the new questions/related UI is absent. This is outside the changed Edge Function surface and is not an A1 rollback trigger.
- outstanding production smokes: direct `keyword_serp`, `creators`, and `article_evidence`. No direct credential is available without a secret or session-store action; the beginner-plan creator gate and article-generation-only application path may not be bypassed.
- receipt status: `DEPLOYED, SMOKE INCOMPLETE`
- provider balance: `$42.129398` before deploy and `$41.914722` after the completed calls; `$0.214676` change, below the `$5` escalation and `$10` rollback ceilings
- receipt: `docs/releases/DEC-2026-08-27-SEO-RESEARCH-REDEPLOY/POST_DEPLOY_RECEIPT.md`
- required observation: continuous first 60 minutes, then 6-, 24-, and 72-hour checkpoints; all prior stop and rollback ceilings remain binding
- explicit prohibition: no Replit republish, plan-tier change, Anthropic article-generation invocation, secret/config change, database write, auth/RLS change, or credential workaround is authorized

## CTO launch-readiness decision: D-LAUNCH-READINESS-1

[2026-08-27] D-LAUNCH-READINESS-1 | HIGH | Issued by: Fable 5 High, Destiny CTO under HARNESS_POLICY.md GOV-1
Canonical source: origin/main 450ae943fde32ad479692a851e09bc6d58a27944 (verified equal to audit workspace HEAD).
Verified defect basis: rank-digest v4 `providerEvent()` (`supabase/functions/rank-digest/index.ts:121-132, :143`) swallows all receipt-lookup failures (null + continue, no persisted error, `last_checked_at` never advanced); every `rank_digest_sends` row shows `last_checked_at == sent_at`, `delivered_at` null. `provider_event: "sent"` is an optimistic write at send time (`index.ts:315`), not provider evidence. Root cause is most consistent with a `sending_access`-only Resend key (`GET` requires `full_access` -> 401), but key permission is INFERRED, not confirmed; no secret was read. Production `seo-research` v12 lacks the `keyword_serp` branch present on main (`seo-research/index.ts:109`).

### A. Email receipt architecture

Staged two-step: APPROVED and REQUIRED.

1. Step 1 (now): instrument the receipt lookup. On every reconcile attempt, advance `last_checked_at` regardless of outcome, and emit a structured function log per failure containing HTTP status, message ID, and error class. No schema change: reuse existing columns only; do not write synthetic values into `provider_event` because it feeds `deliveryStateFromProviderEvent`. If durable per-row error storage proves necessary, that is a frozen database migration requiring its own decision. Step 1 exists to convert the key-permission inference into evidence.
2. Step 2 (after Step 1 evidence): preferred end state is a signed Resend webhook receiver (Svix signature verification) as the canonical delivery-evidence channel, with the existing poll retained only as backfill. Rotating to a `full_access` key is rejected as the primary fix because it broadens the production credential's blast radius. Step 2 is not authorized by this record; it requires its own decision informed by Step 1 evidence.

### B. PR structure

Keep the two HIGH items separate because they share no code, rollback path, or evidence chain.

1. PR-E1 (HIGH): rank-digest receipt-lookup instrumentation. Code, tests, and this decision link.
2. D-SEO-DEPLOY (HIGH, deploy-only, no code change): redeploy `seo-research` to production Supabase from exact main SHA `450ae943fde32ad479692a851e09bc6d58a27944` (or the then-current protected main SHA, recorded at execution), with post-deploy verification of one production `keyword_serp` response.

Both may proceed in parallel once Jose approves; neither is folded into PR #27 or PR #28.

### C. Next PR: PR-E1

Open PR-E1 now after this record is committed as the branch's first commit.

- Classification: HIGH because this is an email/provider surface whose verification requires a production function deploy and whose purpose is to drive a credentials decision; ambiguity defaults HIGH.
- Allowed paths (exact, no expansion): `destiny-product/supabase/functions/rank-digest/index.ts`, `destiny-product/supabase/functions/rank-digest/logic.ts`, `destiny-product/supabase/functions/rank-digest/reconciliation.ts`, their focused test files (existing `logic.test.ts` plus new rank-digest test files), and `destiny-product/DEPLOY_LOG.md` for this record only. No schema, workflows, other functions, app code, or secrets.
- RED assertions: (1) non-OK receipt lookup produces observable failure evidence and advances `last_checked_at`; (2) thrown/timeout lookup does the same; (3) failure evidence includes HTTP status. RED evidence must be recorded in the PR.
- GREEN: implement the instrumentation while leaving success-path reconciliation outcomes unchanged and keeping existing tests green.
- Acceptance evidence: full `pnpm gate`; `policy-guard`, `checklist-guard`, and `harness-gates` green at the head SHA; staging evidence with matching build stamp; RED and GREEN evidence; `cto-approved` label applied by `joseangelo510`.
- Launch claim boundary: merging PR-E1 authorizes no launch claim for email. Email digests remain "accepted by provider, delivery unverified" until the instrumented function is separately deployed to production, evidence identifies the failure cause, a Step 2 decision is issued and executed, and at least one production `rank_digest_sends` row has `delivered_at` set from genuine provider evidence.

### D. Launch matrix

- WordPress (ClearCheck): CONDITIONAL GO, limited to the certified vertical slice with one verified-live article. PR #27 gates any calendar-accuracy claim.
- Webflow (Smart & Fast): NO-GO for live publishing. Truthful claim ceiling: draft delivery to Webflow CMS.
- Wix (98 Junk It / JAS): NO-GO. No CMS integration records or publishing plans exist.
- Rank tracking: GO, scoped to certified sites with canonical pinned rows and recent successful runs, contingent on those verifications remaining true at launch.
- Email digests: NO-GO. Sends are provider-accepted, but delivery is unverified and the verification path is broken.
- Keyword research: NO-GO until D-SEO-DEPLOY completes with one verified production `keyword_serp` response; then GO. PR #28 does not substitute for provider proof.
- Calendar: CONDITIONAL GO. Basic calendar is GO; schedule/live-state accuracy requires PR #27 merged and verified.
- Social: GO only as manual share links to LinkedIn, X, and Facebook. No automatic-publishing claim.
- Aggregate: NO-GO for any general claim that Destiny publishes and verifies across CMSes with delivery-confirmed reporting.

### E. Authorization boundaries

May proceed now: read-only production observation; keeping PRs #27 and #28 green and rebased; PR-E1 branch work under this approved record.

Requires a separate Jose action: `cto-approved` label on PR-E1; merge authorization for PR #27 and PR #28; D-SEO-DEPLOY execution; any future rank-digest production redeploy; any Resend key rotation, webhook creation, or secret/provider mutation; any Step 2 implementation; any launch-claim publication.

All GOV-1 frozen actions remain frozen. Replit remains production of record. PR #23 remains frozen and unmodified. Rollback for anything executed under this record is a protected revert PR or redeploy of the prior function version, never a production hand edit.

Decided by: Fable 5 High, Destiny CTO under HARNESS_POLICY.md GOV-1
## CTO governance decision: D-CALENDAR-ORPHAN-REPAIR-1

[2026-08-27] D-CALENDAR-ORPHAN-REPAIR-1
Classification: HIGH. Decision: GO to prepare PR #31 for an authenticated, exact-match, dry-run-first repair of an orphaned editorial-calendar row; no merge, deployment, production write, migration, release tag, secret/configuration change, authentication/RLS change, or Replit modification is authorized by this decision.
Trigger: read-only production evidence found one ClearCheck FCRA calendar row in `needs_review` with null CMS linkage while exactly one `cms_transfers` record for the same website, originating audit, exact stored approved keyword, and exact stored draft title is `verified_live` with remote ID `20208951` and a canonical permalink returning HTTP 200. PR #27 cannot repair this null-linkage case.
Safe matching contract: exactly one orphaned calendar row, exactly one exact article draft, and exactly one `verified_live` transfer must match by `website_id`, originating `audit_id`, normalized approved keyword, exact stored title, and exact transfer `article_key`. Fuzzy matching and title similarity are forbidden. Zero or multiple candidates produce a no-op with a report. The transfer permalink must be an absolute HTTP(S) URL returning 2xx at dry-run and confirmation time.
Write contract: the repair runs as a read-only dry-run first. A write requires the exact authenticated user-bound, match-bound, unexpired confirmation digest returned by that dry-run. The function rechecks ownership, candidates, and live permalink before updating one row. It copies only the matched transfer's article key, remote ID, and canonical permalink, sets the truthful published state, and appends who confirmed, when, and the evidence used to the existing transfer verification evidence. Reruns are idempotent.
Required RED proof: unique exact match; multiple transfers; multiple rows; zero candidates; similar-title mismatch; missing, malformed, or non-2xx permalink; missing, wrong-user, or expired confirmation; idempotent rerun. Required QA: registered privileged Edge Function, executable cross-tenant denial, and exact no-extra-row mutation assertions.
Protected order: PR #27 -> PR #28 -> PR #29 -> PR #30 -> PR #31. PR #31 is prepared from `main@450ae943fde32ad479692a851e09bc6d58a27944`, then rebased and fully reverified at the final train tail before protected merge. Jose alone applies `cto-approved` to the final PR head.
Allowed now: decision record, RED tests, matcher, authenticated Edge Function, dry-run report, non-production QA, PR creation, and certification-document updates. Current launch verdict remains NO-GO until PR #27 through PR #31 are merged in order and post-deploy FCRA and Ban-the-Box verification passes.

## CTO test decision: D-LAUNCH-PROOF-MATRIX-1

[2026-08-28] D-LAUNCH-PROOF-MATRIX-1 | MEDIUM | Issued by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md`

- decision record: `qa/decisions/2026-08-28-fable-launch-proof-matrix.md`
- canonical starting SHA: `57666b1078f554ccc4b56ebff96ddd2dbf18f4d4`
- authorized scope: public-artifact verifier, exact multi-website production read-only matrix, all six directed pairs in the disposable three-tenant isolation suite, tests, documentation, and evidence only
- test-change justification: `prod-readonly.spec.ts` is generalized from one hard-coded website to an exact supplied website matrix and adds browser-error assertions; `two-tenant.integration.test.ts` exercises the same existing three tenants in all six directions; `isolation-harness.test.ts` is updated to enforce that stronger matrix; `commit-policy-canonical-main-ref.test.ts` receives only a 15-second local timeout after a verified timeout with no assertion failure
- RED evidence: the two new verifier and matrix suites failed before implementation because their modules did not exist; focused output recorded locally on August 28, 2026
- production mutations: none authorized; live publishing, social posting, credentials, schema, RLS, secrets, configuration, tags, redirects, and deployment remain HIGH and frozen
- completion rule: protected PR, full gate, exact-SHA required checks, and per-site evidence links; saved, drafted, or scheduled states may never be reported as published
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1, at Jose Gallegos's direction.

## CTO production decision: D-CALENDAR-ORPHAN-REPAIR-2

[2026-08-28] D-CALENDAR-ORPHAN-REPAIR-2
Title: Calendar orphan repair — authorize scoped deploy and authenticated dry_run only; confirm/write remains frozen.
Issued by: Fable 5 High, acting CTO of record for Destiny.
Classification: HIGH. This decision supersedes the deployment freeze in D-CALENDAR-ORPHAN-REPAIR-1 only to the exact extent stated below.
Baseline: protected main `150a4d526672f3f9d2b25b27ef928ce630192eac`, tree `e9298ce726979f2f587cca7c869ea42f775adcca`; PR #38 merged with Jose's `cto-approved` label. Exact-main Harness run `33155703806` passed 183 files / 1,183 tests, isolation 3/5, and production-readonly Playwright 22 pass / 32 policy skips. Harness artifact digest: `50e1e706e6eb024e517584cdce8b925adeed112f3ecf0f9ff2839d5f9efd229b`. Focused calendar/security tests 14/14, policy QA, and lint passed. A local URL-normalization matrix test exceeded its five-second timeout under concurrent Stryker load; because the identical SHA is fully green in GitHub and no assertion failed, this is an environmental timing artifact and is not a blocker. Only the exact-SHA GitHub run is release evidence.
Validity: this decision is conditional on every stated fact being reverified from live sources immediately before execution. Any discrepancy voids this decision and restores the D-CALENDAR-ORPHAN-REPAIR-1 freeze. No unstated action may be inferred.
Target: Supabase project `etkksjebqgtkkdqznnxa`, function `calendar-orphan-repair` only.
Decision: CONDITIONAL GO in this strict order: (1) merge this protected decision-record PR with required checks green; (2) reverify the live target is `ACTIVE_HEALTHY`, `seo-research` v13 remains active with JWT verification retained and recent 200s, `calendar-orphan-repair` remains absent, and the CLI remains v2.115.0; (3) deploy only `calendar-orphan-repair` with `verify_jwt=true`; (4) execute the read-only post-deploy smoke; (5) execute exactly one authenticated `dry_run` and capture the required evidence; (6) STOP. Confirm/write remains frozen.
Authorized: deployment of the single new Edge Function with `verify_jwt=true`; read-only smoke checks; one authenticated `dry_run` that performs no write.
Prohibited: any confirm/write invocation; prune; database migration or schema change; RLS or policy change; Supabase Auth Site URL change; Replit modification, decommissioning, republish, or traffic redirect; container-staging push; release tag; change to `seo-research` or any other function; CLI upgrade; secret or configuration change beyond the single-function deployment; CMS publish; email; or social action.
Security finding: the Supabase advisor INFO finding that `cms_transfers` has RLS enabled with no policies is acknowledged and accepted as intentional default-deny behavior for non-service roles. The function is the service-role-only write boundary. No policy or RLS change is authorized.
JWT: `verify_jwt=true` is mandatory and must be reverified from live function configuration after deployment. The function must also enforce its authenticated user boundary, exact-match targeting, and 15-minute user- and match-bound HMAC confirmation token. If live configuration reports JWT verification false or absent, delete the new function and halt.
Post-deploy smoke: (a) function listed active with `verify_jwt=true`; (b) unauthenticated request rejected with 401/403; (c) `seo-research` v13 remains healthy and returns 200; (d) capture a pre-dry-run read of the candidate row for later no-write comparison.
Stop conditions: any write during `dry_run`; any match count other than exactly one; any new-function 5xx; JWT verification not true; degradation of `seo-research` or other production behavior; an authentication-error pattern change; or any discrepancy in the stated live facts. On any stop condition, execute the rollback and do not retry without a new recorded Fable 5 High decision.
Authenticated dry run: one invocation is authorized. Evidence required: timestamp; invoking JWT subject with token redacted; full request and response bodies; the exactly-one matched row identifier; before-and-after target-row reads proving zero mutation including unchanged `updated_at`; invocation logs; and proof that the HMAC confirmation token was issued but not consumed. Missing evidence invalidates the dry run.
Confirm/write: NOT AUTHORIZED. Review of the complete dry-run packet plus a new protected and merged Fable 5 High decision `D-CALENDAR-ORPHAN-REPAIR-3` is required before any production write.
Rollback: the new function has no callers; delete `calendar-orphan-repair` to restore the prior production state. Record rollback trigger and timestamps in this entry. No data rollback is expected because no write is authorized.
Interaction: the `seo-research` v13 Decision C remains unchanged; passive health observation only. Replit remains production of record and fully frozen.
Status: DEPLOYED, AUTHENTICATED DRY_RUN PENDING. The authorized function deployment and read-only smoke completed; confirm/write remains frozen.
PR: https://github.com/joseangelo510/destiny/pull/39
Merge SHA: `beef8d75e0b9a4619813cadcac83f06365a2d44f`
Required check runs: PR harness https://github.com/joseangelo510/destiny/actions/runs/33157611091; latest policy guard https://github.com/joseangelo510/destiny/actions/runs/33157948630; latest checklist guard https://github.com/joseangelo510/destiny/actions/runs/33157948616; latest staging evidence https://github.com/joseangelo510/destiny/actions/runs/33157948624; exact-main post-merge harness https://github.com/joseangelo510/destiny/actions/runs/33158079951
Deploy receipt: at `2026-08-28T09:12:33Z`, Supabase project `etkksjebqgtkkdqznnxa` deployed only `calendar-orphan-repair` version `1`, status `ACTIVE`, with `verify_jwt=true`; deployment source digest `f8b48e9de2e043e4c22e4a8632ce0f800b7900faaf72567a518ab2a6da6119c6`. The exact-main harness artifact digest is `c69cd14ed38592eb885f356f49bfcb0b5a7a8e6eba9f075a5aea139dae481f32`. An unauthenticated POST was rejected with HTTP `401` and `UNAUTHORIZED_NO_AUTH_HEADER`. `seo-research` remained active at version `13` with `verify_jwt=true` and recorded HTTP `200` responses. The ClearCheck public permalink returned HTTP `200`.
Dry-run receipt: not executed. No safe existing user JWT was available to the executor, and extracting, manufacturing, or working around a user credential is not authorized. The exact candidate remained singular, and the post-smoke readback proved zero mutation: item `10e64100-6b99-4dc5-8e64-9318e75f9955` stayed `needs_review` with null CMS linkage and unchanged `updated_at` `2026-08-16 20:25:31.058693+00`; transfer `558f3d60-1f46-41c6-b745-d7675d72fb7e` retained unchanged `updated_at` `2026-08-18 23:15:04.755+00`. Resume only with a safely available authenticated Destiny user session; do not use a service-role token or credential workaround. No confirmation token was issued or consumed.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-DIVERGENCE-AUDIT-1

[2026-08-28] D-REPLIT-DIVERGENCE-AUDIT-1
Title: Record D-REPLIT-REPUBLISH-2 as STOPPED-VOID at mandatory precheck 4; classify the observed Replit divergence as unproven-cause true divergence; authorize a strictly read-only divergence audit; keep every frozen action frozen.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — supersession of a recorded HIGH decision plus investigation of frozen surface 2 (Replit production), read-only only.

### 1. Status of D-REPLIT-REPUBLISH-2: STOPPED-VOID

Mandatory precheck 4 (Replit state parity) failed before any publish: on Replit app Destiny SEO (`ee690524-db57-4050-86d0-03bad18452f7`), read-only inspection reported workspace HEAD `3fca8286853c12715530f9e9fb91abd5a5a9b4c4` with the ancestor check against `082c70f1aecc8d3c395ea12f3542bd146fc57a01` failing, and a file comparison (DEPLOY_LOG excluded) that was not empty: many `destiny-product` paths absent and application files modified, including keyword-research UI, rank-tracker code, `seo-research` function logic, and global CSS. By its own section 4 terms, D-REPLIT-REPUBLISH-2 is void. No production mutation, config, env, secret, domain, Auth, function, database, RLS, tag, or Fly change occurred; the executor stopped correctly and did not force-sync. Its section 2 immutable artifact definition (application content of `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, excluding `destiny-product/DEPLOY_LOG.md`) and section 3 governance-equivalence predicate remain adopted as definitions for future decisions; the publish authorization is extinguished.

### 2. Evidence treatment

The divergence is treated as true divergence until a completed audit proves otherwise. Three hypotheses must be distinguished with evidence: (a) repository-layout/mapping artifact — can explain the absent `destiny-product` paths, cannot explain content modifications in correctly-mapped application files; (b) stale-but-clean — Replit workspace equals an older GitHub ancestor state and "modified" files are old versions; (c) foreign content matching no GitHub commit — a potential unauthorized-modification security event. The git ancestry failure alone is weak evidence because Replit generates its own checkpoint history; the content diffs are strong evidence.

### 3. Authorized: read-only divergence audit only

After this record's protected PR merges, the executor may, read-only: (1) prove the workspace-to-repo root mapping via marker files before classifying any path as deleted, then re-run the comparison under the proven mapping; (2) enumerate the full Replit workspace inventory with per-file sizes and content hashes against `git ls-tree -r` of tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, excluding `destiny-product/DEPLOY_LOG.md` and expected Replit-local files (`.replit`, `replit.nix`, caches, `node_modules`, env files by name only — secret values never read); (3) capture verbatim byte-level diffs of each reported-modified file against `git show 082c70f1aecc8d3c395ea12f3542bd146fc57a01:<path>`; (4) determine whether `3fca8286853c12715530f9e9fb91abd5a5a9b4c4` exists in GitHub history and whether any GitHub commit's application tree equals the Replit content under the proven mapping; (5) read Replit git metadata (log, parents, authors, timestamps, remotes) for the workspace HEAD lineage; (6) capture the published-deployment identity via read-only publish status, distinct from workspace state, as the rollback baseline for any future decision; (7) capture a live behavior baseline via read-only GETs on public routes; (8) append a full audit report to this entry classifying every divergent path as artifact, stale, or foreign, with a single hard-to-vary (a)/(b)/(c) determination.

### 4. Prohibited

Everything else. Specifically: any Replit write, sync, force-sync, git pull/push/checkout/reset, file edit, publish, republish, or rollback publish; any config, environment, secret, domain, or Auth Site URL change; any function deploy or change including `seo-research`; database migration or schema change; auth, RLS, or security-model change; `container-staging` push; release tag creation or mutation; parallel-launch (`app.caminoseo.com`) change; Replit-to-Fly traffic redirect; Replit decommissioning; reading any secret value; repairing Replit state even if the fix appears trivial.

### 5. Stop rules

Stop immediately and record if: any tool would or did modify Replit state; the read-only guarantee of any tool is uncertain (do not use it); the root mapping cannot be proven (do not guess); or evidence of hypothesis (c) foreign content appears — in that case escalate to Jose Gallegos as a potential security event and perform no further Replit interaction without a new recorded Fable 5 High decision.

### 6. Success criteria and forward gate

The audit is complete when every divergent path is classified with evidence, the root mapping is proven, the (a)/(b)/(c) determination is stated, the workspace-versus-published-deployment distinction and live baseline are documented, and the report is appended here. Audit completion authorizes no reconciliation, sync, or publish. Any such action requires a new protected, merged Fable 5 High decision (D-REPLIT-REPUBLISH-3) that binds to the same immutable artifact definition, re-runs all prechecks, and may authorize a publish only on proof of exact application parity. No launch, deploy, or readiness claim may be made from this decision; D-LAUNCH-READINESS-1 keyword-research status remains NOT GO pending a successful republish and `keyword_serp` postcheck under a future decision.

### 7. Decision-record PR

This entry must merge via a protected, governance-only decision-record PR (touching only `destiny-product/DEPLOY_LOG.md`) with `cto-approved` applied by `joseangelo510` and `policy-guard`, `checklist-guard`, and `harness-gates` green at the PR SHA, before any audit step executes. The merge is a governance-only descendant and preserves the D-REPLIT-REPUBLISH-2 section 3 equivalence predicate for future reuse.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. Audit not started.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-REPUBLISH-2

[2026-08-28] D-REPLIT-REPUBLISH-2
Title: Void D-REPLIT-REPUBLISH-1 as unsatisfiable; re-authorize exactly one controlled Replit production republish, bound to immutable application content, with a non-recursive governance-equivalence rule.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1, at Jose Gallegos's direction.
Classification: HIGH — frozen action 2 (Replit production modification) plus supersession of a recorded HIGH decision.

### 1. Status of D-REPLIT-REPUBLISH-1: VOID

D-REPLIT-REPUBLISH-1 is void by its own validity clause. Its step 2 required `origin/main` tip to equal `082c70f1aecc8d3c395ea12f3542bd146fc57a01` after merging the decision-record PR, which its step 1 mandated first; the required merge necessarily advances `main`, so step 2 can never be true. This is a specification defect (pinning a moving branch tip instead of immutable content), not a security event. No production mutation occurred under D-REPLIT-REPUBLISH-1, and none may occur under it. Its PR #43 merge (`612b84c42bebaf7bb92cf36e26fcbeef786c8c45`, `cto-approved` by `joseangelo510`, required checks green) remains a valid governance record of intent and is incorporated here as evidence, not as deploy authorization.

### 2. Authorized immutable application artifact

Authorization binds to application content, not a branch tip. The authorized artifact is the application content of commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`), defined as the full repository tree excluding the governance ledger path `destiny-product/DEPLOY_LOG.md`. This definition is immutable: no future merge can change it, and it is mechanically checkable at any tip via the equivalence predicate below.

### 3. Governance-equivalence rule (the non-recursion mechanism)

A commit T is application-equivalent to the authorized artifact if and only if both hold:

- `git merge-base --is-ancestor 082c70f1aecc8d3c395ea12f3542bd146fc57a01 T` succeeds; and
- `git diff --name-only 082c70f1aecc8d3c395ea12f3542bd146fc57a01 T -- . ':(exclude)destiny-product/DEPLOY_LOG.md'` is empty.

A governance-only descendant (a merge that appends only to `destiny-product/DEPLOY_LOG.md`) is application-equivalent and does not invalidate this authorization. Because every future decision-record merge is by construction governance-only, this decision's own record PR — and any later governance appends — satisfy the predicate automatically. No decision under this rule may ever pin the post-merge tip SHA of its own record PR; that pattern is retired as defective. Already verified: `612b84c42bebaf7bb92cf36e26fcbeef786c8c45` is application-equivalent (ancestor check passes; excluded diff is empty).

### 4. Mandatory prechecks

All prechecks must pass immediately before republish; any failure means STOP and this decision voids.

1. Governance record merged with `cto-approved` by `joseangelo510` and `policy-guard`, `checklist-guard`, and `harness-gates` green at the PR SHA, with verifiable run URLs.
2. Live `origin/main` tip passes the application-equivalence predicate in section 3, evidenced by the two command outputs.
3. The green exact-SHA harness run for `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (run `33163480250`) is confirmed by verifiable URL.
4. Replit state parity: because the Replit publish connector deploys current app state and accepts no Git SHA, prove before publishing that current Replit app state content-matches the authorized application artifact (build stamp or file-level comparison against tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, `DEPLOY_LOG.md` excluded). Any divergence means STOP; do not fix Replit state to force a match.
5. Capture the current Replit deployment identity or snapshot before touching anything as the rollback baseline.
6. Supabase `seo-research` v13 is `ACTIVE_HEALTHY`, `verify_jwt=true`, with recent HTTP 200 responses.
7. Auth-boundary smoke: authenticated `keyword_serp` returns 200 through a real Destiny user session, while unauthenticated returns 401 or 403. No service-role token or credential workaround.
8. Frontend parity: keyword-research UI and same-origin `keyword_serp` route are verified on staging or preview built from the authorized artifact, with zero console errors and zero 5xx.

### 5. New protected decision PR: REQUIRED

This record must merge via a protected decision-record PR before execution, with `cto-approved` from `joseangelo510` and all required checks green at the PR SHA. Its merge SHA is not pinned in advance and is not a precheck input; after merge, it is validated solely by the section 3 predicate and must be a governance-only descendant. That closes the recursion: the record's own merge cannot contradict the conditions it imposes.

### 6. Execution, rollback, and stop rules

- GO only after section 5 merges and every section 4 precheck passes, in that order. Then execute exactly one Replit production republish of the verified current app state. Nothing else.
- Postchecks: live build identity matches the authorized artifact; auth journey (login, session, callback) is unregressed; zero 5xx on touched routes; keyword-research UI renders and same-origin `keyword_serp` succeeds authenticated and rejects unauthenticated; core journeys are spot-checked; `seo-research` remains v13, `verify_jwt=true`, and healthy.
- Rollback: on build-identity mismatch, any auth regression, any 5xx on touched routes, `keyword_serp` production failure, function degradation, or any precheck/postcheck discrepancy — immediately republish the section 4.5 snapshot, record trigger and timestamps, and STOP. No retry or second republish without a new recorded Fable 5 High decision.
- Prohibited: Supabase Auth Site URL change; any secret, environment, configuration, or domain change; any function deploy or change (including `seo-research`); database migration or schema change; auth, RLS, or security-model change; `container-staging` push; Replit-to-Fly traffic redirect; release tag creation or mutation; parallel-launch (`app.caminoseo.com`) change; Replit decommissioning; more than one republish.
- Truthful-claim boundary: status is AUTHORIZED — NOT DEPLOYED until postcheck evidence is appended. The only permitted completion claim is that Replit production was republished at application content equivalent to `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`) with required checks green and postchecks passed, backed by run URLs. A successful republish plus a passing `keyword_serp` postcheck flips keyword research to GO under D-LAUNCH-READINESS-1; no broader launch claim is authorized.

Evidence required for completion: this entry's PR URL and merge SHA; equivalence-predicate command outputs; exact-SHA check-run URLs; Replit parity proof; precheck receipts with tokens redacted; republish receipt with timestamp and deployed identity; postcheck results; rollback baseline identity. Missing evidence means not complete.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No execution before its merge.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-REPUBLISH-1

[2026-08-28] D-REPLIT-REPUBLISH-1
Title: Authorize exactly one controlled Replit production republish of exact protected main SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01`; all other frozen actions remain frozen.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1, at Jose Gallegos's direction.
Classification: HIGH — frozen action 2 (Replit production modification). PR #42 was MEDIUM test-only and authorized no deploy; its merge is not deploy authorization. Chat approval does not weaken GOV-1; this recorded decision is the sole authorization instrument.
Baseline: protected `main` at `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (`test: add deterministic launch proof matrix (#42)`, `cto-approved` by `joseangelo510`), exact-main harness run `33163480250` green. Independently verified via `git ls-remote` that canonical `origin/main` points at this exact SHA. A local checkout's stale `main` ref is immaterial; only live GitHub state at the exact SHA is evidence.
Validity: conditional on every stated fact being reverified from live sources immediately before execution. Any discrepancy voids this decision and restores the freeze. No unstated action may be inferred.

Decision: CONDITIONAL GO, in this strict order:
1. Merge this protected decision-record PR with `cto-approved` applied by `joseangelo510` and all required checks (`policy-guard`, `checklist-guard`, `harness-gates`) green at the PR SHA. No implementation before this merge. The decision-record PR must merge first.
2. Reverify live: `origin/main` tip is exactly `082c70f1aecc8d3c395ea12f3542bd146fc57a01`; run `33163480250` is green at that exact SHA with a verifiable URL; Supabase `seo-research` v13 is `ACTIVE_HEALTHY` with `verify_jwt=true` and recent 200s; capture the current Replit deployment identity or snapshot as the rollback baseline before touching anything.
3. Complete the outstanding prechecks before republish: (a) direct authenticated `keyword_serp` smoke against `seo-research` v13 returns 200 using a safely available authenticated Destiny user session, while an unauthenticated request returns 401 or 403; no service-role token or credential workaround; (b) frontend parity of the keyword-research UI and same-origin `keyword_serp` route on staging or preview built from `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, with zero console errors and zero 5xx. Either failure means stop and voids this decision.
4. Execute exactly one Replit production republish of exact SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01`. No config, environment, secret, domain, or Auth Site URL change of any kind.
5. Postchecks: build identity on live Replit matches `082c70f1aecc8d3c395ea12f3542bd146fc57a01`; authentication journey (login, session, callback) is unregressed; touched routes have zero 5xx; keyword-research UI renders and same-origin `keyword_serp` succeeds authenticated and rejects unauthenticated; pre-existing core journeys are spot-checked healthy; `seo-research` remains v13, `verify_jwt=true`, and healthy.
6. Append evidence to this entry and stop.

Authorized: the single republish above, its prechecks, postchecks, and rollback. Nothing else.
Prohibited: Supabase Auth Site URL change; database migration or schema change; auth, RLS, or security-model change; any `seo-research` or other function change; `container-staging` push; Replit-to-Fly traffic redirect; release tag creation or mutation; parallel-launch (`app.caminoseo.com`) change; Replit decommissioning; secrets or configuration changes; any second republish or retry after a stop condition.

Rollback target: the pre-republish Replit deployment snapshot captured in step 2, restored by republishing that prior state and never hand-edited.
Rollback conditions: execute immediately and stop on build-identity mismatch, any auth regression, any 5xx on touched routes, `keyword_serp` failure in production, `seo-research` degradation, discrepancy in reverified facts, or any postcheck failure. Record the trigger and timestamps. No retry without a new recorded Fable 5 High decision.

Evidence required for completion: this entry's PR URL and merge SHA; exact-SHA required check-run URLs; precheck receipts with token redacted; parity results; republish receipt with timestamp and deployed identity; postcheck results; and rollback baseline identity. Missing evidence means not complete.

Truthful launch-claim boundaries: until step 5 evidence is recorded, status is AUTHORIZED — NOT DEPLOYED, and nothing may be described as launched, live, or verified. After green completion, the only permitted claim is: “Replit production republished at exact protected main SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01` with required checks green and postchecks passed,” backed by run URLs. It may never be claimed that a release tag exists, that the parallel Fly launch changed, that traffic was redirected, or that the keyword feature is production-verified beyond the recorded smoke and parity evidence. No gate may be claimed passed without a verifiable run URL.

Status: AUTHORIZED — NOT DEPLOYED. Awaiting protected decision-record PR, prechecks, and controlled execution.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.
