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

## CTO production decision: D-REPLIT-REPUBLISH-3

[2026-08-28] D-REPLIT-REPUBLISH-3
Title: Authorize a staged deterministic reconciliation of the stale-but-clean Replit workspace to the immutable authorized application artifact, gated on read-only build-root proof and full blob-map parity, followed by exactly one controlled Replit production republish; all other frozen actions remain frozen.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — frozen action 2 (Replit production modification), successor to STOPPED-VOID D-REPLIT-REPUBLISH-2, issued under the forward gate of D-REPLIT-DIVERGENCE-AUDIT-1 section 6.

### 1. Basis and inherited definitions

D-REPLIT-DIVERGENCE-AUDIT-1 closed `STALE-CONFIRMED`: on Replit app Destiny SEO (`ee690524-db57-4050-86d0-03bad18452f7`), the Git-mapped workspace equals GitHub commit `1095526d70fddfa014e46e062ac00ea388c35fe4` content exactly (597 included files, 0 modified, 0 missing, 0 extra), differs from the authorized target at exactly 31 modified plus 25 missing paths with 0 extra, all classified stale, and hypothesis (c) foreign content is rejected. This decision adopts unchanged the D-REPLIT-REPUBLISH-2 section 2 immutable artifact — the application content of commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, excluding `destiny-product/DEPLOY_LOG.md` — and its section 3 governance-equivalence predicate. The recorded rollback baseline is published deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d`, status `success`, URL `https://destiny-seo.replit.app`, with live read-only baseline `GET /` 200, `GET /login` 200, `GET /api/version` 401, `GET /keyword-research` redirect-to-login 200.

### 2. Staging decision: one decision, hard read-only gate first

A separate decision cycle for the build-root inspection is not required. Stage 0 below is strictly read-only, its pass condition is specified deterministically in advance, and no workspace write may occur before Stage 0 passes; any Stage 0 surprise voids the write and publish authorizations entirely, restoring the freeze. This preserves GOV-1 — no sync or publish without deterministic build-root and parity proof — without a redundant governance round-trip. Stages execute strictly in order after the section 9 PR merges; any stop rule anywhere means STOP, record, and no further Replit action without a new recorded Fable 5 High decision.

### 3. Stage 0 — read-only build-root and config proof

Because the workspace carries root-level duplicate marker files, the built root must be proven, not assumed. Allowed, read-only: capture verbatim the `.replit` file (including every `[deployment]` `build`, `run`, and working-directory setting), `replit.nix`, and the read-only publish status/configuration pane; enumerate the root-level duplicate files by name and size only. Pass condition: the deployment build and run commands reference exactly one application root, that root is the Git-mapped `destiny-product/` tree proven by the audit, and no root-level duplicate file participates in the deployment build or run path. Also capture the pre-publish differential baseline: the exact unauthenticated status of `GET /api/research/keyword-serp` on the live site (this route is absent from the stale content, so its live behavior must reflect route-absence; record whatever status is observed). If the configuration is ambiguous, contradictory, references the repository root or any duplicate file, or cannot be read without a write-capable tool, STOP: the reconciliation and publish authorizations void.

### 4. Stage 1 — deterministic reconciliation mechanism

The only permitted mechanism is raw Git in the Replit workspace shell at the proven repository root. No natural-language agent rewrite, no per-file editor changes, no Replit Agent involvement of any kind. Exact sequence, each output recorded verbatim:

1. `git status --porcelain` — must be empty or contain only approved-excluded paths; otherwise STOP.
2. `git rev-parse HEAD` — recorded as the workspace pre-sync reference.
3. Fetch the canonical repository (`https://github.com/joseangelo510/destiny`), then verify `git cat-file -t 082c70f1aecc8d3c395ea12f3542bd146fc57a01` reports `commit` and `git rev-parse 082c70f1aecc8d3c395ea12f3542bd146fc57a01^{tree}` equals `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. Any mismatch or unreachable object: STOP.
4. `git checkout 082c70f1aecc8d3c395ea12f3542bd146fc57a01 -- .` — an overwrite-only pathspec restore. It writes every path present in the authorized commit, deletes nothing, and never touches untracked Replit-local files (`.replit`, `replit.nix`, env files, caches, `node_modules`), which is exactly correct because the audit proved 0 extra paths; Stage 2 re-proves it.
5. Exactly one dependency install honoring the committed lockfile (the workspace's standard package manager with its frozen-lockfile mode) inside the proven build root, required because `package.json` is among the reconciled files. If the install mutates the lockfile or fails, STOP and execute the section 7 workspace rollback.

No `git push` from Replit, ever. No branch switch, `reset --hard`, merge, or rebase. Replit auto-checkpoint commits are tolerated but must never be pushed. Secret and environment values are never read or changed; env files are referenced by name only.

### 5. Stage 2 — parity proof and remaining prechecks

All must pass, in order, immediately before publish; any failure means STOP and the publish authorization voids.

1. Governance: this entry merged per section 9, with `cto-approved` applied by `joseangelo510` and `policy-guard`, `checklist-guard`, and `harness-gates` green at the PR SHA, with verifiable run URLs.
2. Live `origin/main` tip passes the inherited application-equivalence predicate, evidenced by both command outputs.
3. The green exact-SHA harness run for `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (run `33163480250`) confirmed by verifiable URL.
4. Full post-sync parity: re-run the audit's deterministic relative-path-to-Git-blob-SHA comparison with the identical approved exclusions. The result must be exactly 0 modified, 0 missing, 0 extra against tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. Sampling is insufficient; any nonzero count — including any extra path — is a STOP.
5. Rollback baselines re-confirmed and recorded: the section 1 published deployment identity and live route baseline, plus the Stage 1 pre-sync workspace reference.
6. Supabase `seo-research` v13 is `ACTIVE_HEALTHY`, `verify_jwt=true`, with recent HTTP 200 responses.
7. Auth-boundary smoke against the reconciled workspace preview: authenticated same-origin `keyword_serp` returns 200 through a real Destiny user session obtained by interactive login; unauthenticated returns 401 or 403. No service-role token, no credential extraction, manufacture, or workaround, consistent with the D-CALENDAR-ORPHAN-REPAIR-2 boundary.
8. Frontend verification on the reconciled workspace preview: keyword-research UI renders with zero console errors and zero 5xx on touched routes.

### 6. Stage 3 — one republish and postchecks

Execute exactly one Replit production republish of the verified reconciled workspace state through the standard publish action, accepting only existing settings — no configuration, environment, secret, domain, or machine change in any publish dialog. Postchecks, all mandatory: publish status `success` with the new deployment identity recorded; build-root differential flips — unauthenticated `GET /api/research/keyword-serp` now returns 401 or 403 (route exists), which deterministically proves the published build came from the reconciled Git-mapped root, and authenticated `GET /api/version` returns 200 with build identity consistent with the authorized artifact; authentication journey (login, session, callback) unregressed; `GET /` and `GET /login` return 200; keyword-research UI renders authenticated and same-origin `keyword_serp` succeeds authenticated and rejects unauthenticated; zero 5xx on touched routes; `seo-research` remains v13, `verify_jwt=true`, healthy.

### 7. Rollback and stop rules

- Workspace rollback (any failure before publish): `git checkout 1095526d70fddfa014e46e062ac00ea388c35fe4 -- .` after fetching that commit, restoring the audited pre-sync content, verified by the same blob-map comparison against `1095526d` (597 files, 0/0/0). Then STOP.
- Production rollback (any postcheck failure): exactly one rollback republish restoring recorded deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d` via Replit's deployment rollback of that identity, never hand-edited. Then STOP. The rollback republish is the sole exception to the one-publish rule and consumes it.
- Stop immediately and record on: any Stage 0 ambiguity; non-excluded dirty tree; unreachable pinned commit or tree-hash mismatch; any parity count other than 0/0/0; lockfile mutation; auth-smoke failure; console errors or 5xx; any tool whose read-only or write behavior is uncertain; any Replit UI prompt offering to sync, revert, apply, or checkpoint anything beyond the exact listed commands; or any evidence the workspace is not the audited stale-but-clean state — the last escalates to Jose Gallegos as a potential security event. No retry and no second forward republish without a new recorded Fable 5 High decision.

### 8. Allowed and prohibited

Allowed, and nothing else: the Stage 0 read-only captures; the Stage 1 command sequence; the Stage 2 precheck and parity runs including workspace preview startup; the single Stage 3 republish and its postchecks; the section 7 rollbacks.
Prohibited: Supabase Auth Site URL change; any secret, environment, configuration, or domain change, and any secret value read; any function deploy or change including `seo-research`; database migration or schema change; auth, RLS, or security-model change; `container-staging` push; Replit-to-Fly traffic redirect; release tag creation or mutation; parallel-launch (`app.caminoseo.com`) change; Replit decommissioning; `git push` from Replit; branch switch, hard reset, merge, or rebase in the workspace; any natural-language agent rewrite or per-file manual edit of application files; more than one forward republish; service-role tokens or credential workarounds.

### 9. Decision-record PR

The completed D-REPLIT-DIVERGENCE-AUDIT-1 section 8 report (already committed on `gov/replit-divergence-audit-report-1` at `20e72f9`) and this decision MAY share one governance-only protected PR touching only `destiny-product/DEPLOY_LOG.md`. The audit's execution was fully authorized by the already-merged PRs #45 and #46, so its report is evidence-append only and creates no authorization coupling. The shared PR requires `cto-approved` applied by `joseangelo510` and `policy-guard`, `checklist-guard`, and `harness-gates` green at the PR SHA, with verifiable run URLs, before any Stage 0 step executes.

### 10. Truthful-claim boundary

Status is AUTHORIZED — NOT EXECUTED until evidence is appended. The only permitted completion claim is that Replit production was republished at application content equivalent to `082c70f1aecc8d3c395ea12f3542bd146fc57a01` (tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`) with required checks green, full blob-map parity 0/0/0, build-root proof recorded, and postchecks passed, all backed by run URLs and receipts. A successful republish plus a passing `keyword_serp` postcheck flips keyword research to GO under D-LAUNCH-READINESS-1; no broader launch, readiness, or migration claim is authorized. Evidence required for completion: the shared PR URL and merge SHA; required check-run URLs; Stage 0 config captures; Stage 1 command transcripts; the 0/0/0 parity output; precheck receipts with tokens redacted; the republish receipt with timestamp and new deployment identity; postcheck results; and both rollback baselines. Missing evidence means not complete.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No execution before its merge.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-DIVERGENCE-AUDIT-1-AMEND-1

[2026-08-28] D-REPLIT-DIVERGENCE-AUDIT-1-AMEND-1
Title: Resolve the stuck read-only Replit provenance scan with a guarded task stop and deterministic local tree-hash proof; keep every frozen action frozen.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — execution amendment inside the already-authorized investigation of frozen surface 2 (Replit production), read-only only.

### 1. Guarded stop of the stuck read-only agent task

The Replit Agent's history-wide, read-only tree scan hit GitHub API rate limits and did not reach a conclusion. Clicking Stop is authorized only to halt that computation, because it does not modify Replit production files, Git, configuration, secrets, environment, or deployment state. This authorization is valid only if Stop solely halts the task. If the UI couples Stop to any checkpoint, revert, rollback, or apply/discard-changes prompt, the executor must decline every such prompt, close the pane without accepting anything, and stop. After stopping, the executor must confirm the Agent left no pending change set or checkpoint/diff panel. The stop event and confirmation must be logged in the audit report.

### 2. Deterministic replacement proof

After the guarded stop and confirmation, the executor may obtain exactly these read-only outputs from the Replit workspace, preferring the shell/console over another non-deterministic Agent request when reachable:

1. `git status --porcelain`
2. `git rev-parse HEAD`
3. `git rev-parse HEAD:destiny-product`

`git status --porcelain` must be empty, or empty within the already-approved exclusion set. The Replit `destiny-product` tree hash must be compared locally against `git rev-parse 61745a2c4b5a461b27d5574d6cd472ff9bc67dfa:destiny-product` in the audit clone. If the working tree is clean and the two tree hashes are equal, that is cryptographic proof that every file — including all 56 inventoried differences and all unsampled files — is byte-identical to GitHub commit `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa`. The abandoned history-wide scan is then superseded.

If the tree hashes differ only because approved exclusions may live inside `destiny-product/`, the only authorized fallback is one read-only `git ls-tree -r HEAD destiny-product`, compared locally against `git ls-tree -r 61745a2c4b5a461b27d5574d6cd472ff9bc67dfa destiny-product` with the approved exclusions filtered. Every non-excluded path must match by blob SHA.

### 3. Sampling is insufficient

The exact 31-modified/25-missing/0-extra path-status identity between Replit and the GitHub `61745a2c` to `082c70f1` diff, plus two byte-exact older-GitHub blob samples, is strong but circumstantial for the remaining modified paths. Tree-level or complete filtered blob-map equality remains mandatory before all 56 differences may be classified stale.

### 4. Allowed actions and stop conditions

Allowed, in order, and nothing else: (1) click Stop on the stuck read-only agent task under section 1 guards and verify no pending change set; (2) obtain the three raw read-only Git outputs in section 2; (3) compare the Replit tree hash locally against the `61745a2c` tree hash; (4) only if those hashes differ, run the one filtered `git ls-tree` fallback; (5) append all outputs and the verdict `STALE-CONFIRMED`, `DIVERGENCE-FOUND` at listed paths, or `INCONCLUSIVE` to the audit record.

Stop immediately and report with no further Replit action if: the comparison completes in either direction; `git status --porcelain` shows non-excluded dirt; HEAD is unexpected; any command errors; or any Replit UI prompt offers to apply, revert, sync, or checkpoint anything. A match closes the audit `STALE-CONFIRMED`. A mismatch after the filtered fallback closes it with the divergent path list. Any subsequent reconciliation, sync, or publish requires a new recorded Fable 5 High decision.

### 5. Explicitly prohibited

Any Replit sync, pull, push, checkout, reset, edit, publish, redeploy, config change, dependency install, secret or environment read/change, function/database/Auth/RLS change, traffic change, release tag, further agent prompts beyond the exact deterministic replacement proof, or any other action not listed above.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. Amendment not executable before merge.
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

### 8. Audit completion report

Governance receipts: the audit decision merged through protected PR https://github.com/joseangelo510/destiny/pull/45 at merge SHA `23b56315c48615ffe10bc047b7f73a3e221ed53b`, with `cto-approved` applied by `joseangelo510`, required PR checks green, and exact-main harness https://github.com/joseangelo510/destiny/actions/runs/33178668806 green. The execution amendment merged through protected PR https://github.com/joseangelo510/destiny/pull/46 at merge SHA `7be540415575d5ac6a00e072a7e2903e4cac2aed`, with `cto-approved` applied by `joseangelo510`, required PR checks green, and exact-main harness https://github.com/joseangelo510/destiny/actions/runs/33181702255 green.

Root mapping: proven. The Replit workspace contains both root-level and `destiny-product/` marker copies, but the Git-tracked application markers are `destiny-product/package.json`, `destiny-product/next.config.ts`, and `destiny-product/src/app/keyword-research/page.tsx`. Therefore GitHub `destiny-product/<path>` maps to Replit `destiny-product/<path>`; the earlier apparent mass deletion was partly an invalid unmapped comparison, not the final audit result.

Authorized-target inventory: after the approved exclusions, the mapped Replit application differs from authorized commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01` at exactly 56 paths: 31 modified, 25 missing, 0 extra.

Modified — all classified `STALE` by the full-tree match: `file-length-baseline.json`; `package.json`; `qa/e2e/mvp-certification.spec.ts`; `qa/e2e/prod-readonly.spec.ts`; `qa/inventory/coverage-ledger.csv`; `qa/inventory/privileged-edge-functions.json`; `qa/inventory/routes.json`; `qa/inventory/static-controls.json`; `qa/isolation/two-tenant.integration.test.ts`; `qa/rules/commit-policy-canonical-main-ref.test.ts`; `qa/rules/edge-runtime-negative-tests.test.ts`; `qa/rules/isolation-harness.test.ts`; `qa/specs/edge-function-negative-authorization.md`; `qa/specs/publishing-lifecycle.md`; `scripts/qa-browser-fixture.mjs`; `src/app/api/rank-tracker/keywords/route.ts`; `src/app/globals.css`; `src/app/keyword-research/page.tsx`; `src/components/keyword-research-workspace.tsx`; `src/components/publishing-plan-manager.tsx`; `src/components/rank-tracker-workspace.test.tsx`; `src/components/rank-tracker-workspace.tsx`; `src/lib/content/publishing-plan.ts`; `src/lib/quests/guidance-state.test.ts`; `src/lib/quests/guidance-state.ts`; `src/lib/seo/research.ts`; `supabase/functions/rank-digest/index.ts`; `supabase/functions/rank-digest/reconciliation.ts`; `supabase/functions/seo-research/index.ts`; `supabase/functions/seo-research/logic.test.ts`; `supabase/functions/seo-research/logic.ts`.

Missing — all classified `STALE` because they were added after the matched snapshot: `qa/decisions/2026-08-28-fable-launch-proof-matrix.md`; `qa/e2e/keyword-research-persistence.spec.ts`; `qa/fixtures/public-artifacts.example.json`; `qa/mocks/prod-site-matrix.test.ts`; `qa/mocks/public-artifact-verifier.test.ts`; `qa/support/prod-site-matrix.ts`; `qa/support/public-artifact-verifier.mjs`; `scripts/qa-public-artifacts.mjs`; `src/app/api/content/publishing-plan/reconcile/route.test.ts`; `src/app/api/content/publishing-plan/reconcile/route.ts`; `src/app/api/rank-tracker/keywords/route.test.ts`; `src/app/api/research/keyword-serp/route.test.ts`; `src/app/api/research/keyword-serp/route.ts`; `src/components/keyword-serp-insights.test.tsx`; `src/components/keyword-serp-insights.tsx`; `src/components/publishing-plan-reconciliation.test.tsx`; `src/components/use-wordpress-calendar-reconciliation.ts`; `src/lib/format-date.test.ts`; `src/lib/format-date.ts`; `supabase/functions/calendar-orphan-repair/deno.json`; `supabase/functions/calendar-orphan-repair/index.test.ts`; `supabase/functions/calendar-orphan-repair/index.ts`; `supabase/functions/calendar-orphan-repair/logic.test.ts`; `supabase/functions/calendar-orphan-repair/logic.ts`; `supabase/functions/rank-digest/receipt-lookup.test.ts`.

Full-tree provenance verdict: `STALE-CONFIRMED`. The canonical relative-path-to-Git-blob-SHA maps were compared after the stated exclusions. Replit and GitHub commit `1095526d70fddfa014e46e062ac00ea388c35fe4` (`2026-08-27T03:16:09Z`, `green: record social and republish reconciliation decisions`) each contained 597 included files with 0 modified, 0 missing, and 0 extra paths. The scan enumerated 607 commits reachable from 46 unique branch/tag tips, compared 606 complete recursive trees, and found 7 exact matches. The sole unavailable tree belonged to the older initial commit dated `2026-08-01T14:37:23Z`, so it cannot supersede the newest match. Two prior byte-level samples independently matched older GitHub blobs: Replit `package.json` matched the blob at `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa`, and Replit `src/app/keyword-research/page.tsx` matched the blob present at that snapshot. Hypothesis (b), stale-but-clean, is confirmed; hypothesis (a) explains only the initial unmapped deletion artifact, and hypothesis (c), foreign content, is rejected by the complete 597-file blob-map equality.

Workspace versus published deployment: the audited Replit workspace is the stale-but-clean snapshot above. The separately captured currently published deployment baseline is `a5e94a27-6ca6-4f32-a8a7-08e671bf965d`, status `success`, URL `https://destiny-seo.replit.app`. No publish, sync, edit, checkout, reset, configuration change, or production mutation occurred during the audit.

Live read-only behavior baseline: `GET /` returned HTTP 200; `GET /login` returned HTTP 200; `GET /api/version` returned HTTP 401; `GET /keyword-research` redirected to `/login?next=%2Fkeyword-research` and completed HTTP 200. No write request was used.

Amendment outcome: the history-wide read-only scan completed before the guarded Stop action was reached, so Stop was not clicked and no replacement shell command was needed. The completed 597-file blob-map proof is stronger than the amendment's proposed tree-hash shortcut. No pending change set, apply/revert prompt, or checkpoint was accepted.

Status: AUDIT COMPLETE — `STALE-CONFIRMED` — NO RECONCILIATION, SYNC, OR PUBLISH AUTHORIZED. Any next action requires a new protected Fable 5 High decision under GOV-1.
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

## CTO production decision: D-REPLIT-REPUBLISH-6

[2026-08-28] D-REPLIT-REPUBLISH-6
Title: Reconcile and republish the pinned authorized artifact to Replit production with truthful detached-HEAD provenance and deterministic post-deploy identity proof.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — frozen action 2 (Replit production modification).
Status: AUTHORIZED — conditional on every gate below, in order. D-REPLIT-REPUBLISH-3/4/5 were never recorded and are VOID.
Recording precondition: This decision is inert until recorded via protected PR to protected `main` with `cto-approved` applied by Jose and all required checks green at the merge SHA. No Replit write, install, build, or publish before that merge.

### A. Artifact and target (immutable)

- Authorized artifact: commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, exact tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. No other ref, branch, or path subset is authorized.
- Target app: Destiny SEO, replId `ee690524-db57-4050-86d0-03bad18452f7`, `https://destiny-seo.replit.app`. No other app.
- Roots: Git commands only at `/home/runner/workspace`. Install and build only at `/home/runner/workspace/destiny-product`.

### B. Scope

Authorized: one workspace reconciliation to the pinned artifact, one dependency install, one build, one publish of the canonical app, and the verifications below. Nothing else. A successful republish plus passing `keyword_serp` postcheck flips keyword research to GO under D-LAUNCH-READINESS-1; no broader launch claim.

### C. Ordered gates

**G1 — Reconcile (detached HEAD; path checkout forbidden).** At `/home/runner/workspace`: fetch `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, then `git checkout --detach 082c70f1aecc8d3c395ea12f3542bd146fc57a01`. `write-build-stamp.mjs` derives SHA and tree from Git HEAD, so a path-only checkout would stamp false provenance. Baseline `1095526d` divergence (31 modified / 25 missing / 0 extra) is resolved solely by this checkout.

**G2 — Tree and untracked verification.** `git rev-parse HEAD` must equal `082c70f1aecc8d3c395ea12f3542bd146fc57a01`; `git rev-parse HEAD^{tree}` must equal `324cd92ca0d06ddb20beb9a16384010a8b2cd541`; `git status --porcelain` must show zero tracked modifications and exactly the audited untracked-file set, with nothing added, removed, or mutated. Any contradiction: STOP.

**G3 — Install (exactly once).** At `destiny-product`, verify `pnpm --version` equals `11.9.0`, then run `pnpm install --frozen-lockfile`. Never run `npm install`. Afterward confirm Git status shows lockfiles unchanged. Any lockfile drift: STOP.

**G4 — Build (exactly once) and prepublish stamp check.** Run the package.json build once. The stamp must show exact SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, exact tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, a valid `builtAt` timestamp after G1, and `source=git`. Do not require `env=production` before publish. Any mismatch: STOP; do not rebuild to fix provenance.

**G5 — Preview smoke (pre-publish).** Security/auth smoke and Supabase health must pass on preview. The pre-existing unauthenticated keyword-serp 401 is security-posture evidence only. It proves nothing about build identity and may not be cited as identity proof.

**G6 — Publish (exactly once).** Publish the canonical app once through the standard Replit deploy flow. No Replit Agent, duplicate or new app, or second publish under this decision.

**G7 — Postpublish identity and health.** All are required: (a) a new Replit deployment ID differing from the prior one; (b) authenticated `GET /api/version` returns exact SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01` and tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, with `env=replit-production` or another explicitly pre-validated production value; (c) authentication flow works; (d) keyword route behaves as specified by the `keyword_serp` postcheck; (e) zero 5xx on touched routes; and (f) Supabase health is green. Any failure: execute rollback under section E.

### D. Proof required for completion

Record the decision PR URL, merge SHA, and green required check-run URLs; G2 outputs; pnpm version and lockfile-unchanged evidence; build-stamp contents; preview smoke results; old and new deployment IDs; authenticated `/api/version` body; and postcheck results. No claim without its artifact.

Mandatory truthful wording: “Production now serves the pinned authorized artifact `082c70f1` / tree `324cd92c` — not current `main` (`4503cd75`).” No parity-with-main claim.

### E. Stop and rollback

Hard stop, freeze, report, and do not improvise on any G2 tree or untracked mismatch, lockfile drift, stamp mismatch, preview smoke failure, publish error, unexpected workspace mutation, or ambiguity. Stopped work resumes only under a new recorded Fable 5 High decision.

If G7 fails after publish, immediately roll back to the previous Replit deployment through the deployments panel, verify that the prior deployment serves traffic and authentication works, record the incident with evidence, and stop. No forward fix, patch, or republish is authorized under this decision.

### F. Forbidden

Supabase Auth Site URL changes; database schema or migration changes; auth, RLS, or security-model changes; secret or config changes; existing-traffic redirects including Replit-to-Fly; release tags; Replit Agent; creating or duplicating apps; `npm install`; more than one install, build, or publish; path checkouts; work outside the two designated roots; and citing the 401 as identity evidence.

### G. Completion

Complete only when this decision PR is merged to `main` with `cto-approved` and green checks, G1 through G7 all pass, and the complete proof set in section D is attached to the deploy log. Anything less is not complete.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No Replit write or publish before its merge.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-BUNDLE-REMEDIATION-7

[2026-08-28] D-REPLIT-BUNDLE-REMEDIATION-7
Title: Remediate the failed Replit bundle through deterministic workspace hygiene, then authorize one pinned-artifact production retry.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — frozen action 2 (Replit production modification) plus governed remediation of a failed production bundle.
Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No cleanup, install, build, or publish before its merge.

### 1. Accepted failure and production state

The controlled publish authorized by D-REPLIT-REPUBLISH-6 passed Provision, Security checks, and Build, then failed during Bundle before Promote with Replit's exact error: `image size is over the limit of 8 GiB: total size of layers exceeds limit`. Production was never promoted and remains on the prior deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d`; no rollback was required. The single D6 publish allowance is consumed. Replit Agent, Fix with Agent, and blind retries remain forbidden.

The immutable application artifact remains commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. The target remains only the canonical Replit app Destiny SEO, replId `ee690524-db57-4050-86d0-03bad18452f7`, at `https://destiny-seo.replit.app`.

### 2. Diagnosis and disk evidence

The failure is classified as workspace hygiene, not an application-artifact failure. Read-only evidence at `/home/runner/workspace` showed: total workspace `6.0G`; root `node_modules` `774M`; `destiny-product/node_modules` `1003M`; root `.cache` `1.2G`; root `.local` `1.5G`; `destiny-product/.next` `1.2G`; root `.next` `134M`; and total `destiny-product` `2.2G`. The publish log failed while pushing the Repl/cache layer.

### 3. Remediation class and exact allowlist

Authorized remediation is untracked Replit workspace cleanup only. No tracked application or runtime configuration change is authorized. Before deleting root `node_modules` or root `.next`, `.replit` must prove that deployment build and run commands target `destiny-product`; otherwise STOP and delete nothing.

Only these six paths may be removed, and nothing else:

1. `/home/runner/workspace/.cache`
2. `/home/runner/workspace/.local`
3. `/home/runner/workspace/node_modules`
4. `/home/runner/workspace/.next`
5. `/home/runner/workspace/destiny-product/node_modules`
6. `/home/runner/workspace/destiny-product/.next`

After the authorized rebuild, only `/home/runner/workspace/destiny-product/.next/cache` may be pruned.

Must not be touched: `/home/runner/workspace/.git`, `.replit`, `replit.nix`, `.config`, every `.env*` path and secret store, every tracked repository file, `destiny-product/` source, and the live production deployment or container. Secrets must not be read, printed, moved, or deleted. If credential material is discovered inside an allowlisted path, STOP before removing it.

### 4. Ordered execution and attempt budget

This protected HIGH docs-only decision PR must merge first with `cto-approved` applied by `joseangelo510` and all required checks green at the final PR SHA. Then, and only then:

1. At `/home/runner/workspace`, verify HEAD equals `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, tree equals `324cd92ca0d06ddb20beb9a16384010a8b2cd541`, and `git status --porcelain` is empty.
2. Verify `.replit` build/run commands target `destiny-product`; record baseline `du -sh` for the workspace and all allowlisted paths; record pnpm version.
3. Remove only the six allowlisted paths.
4. Reverify empty Git status and unchanged HEAD/tree. Verify pnpm `11.9.0`; if removal of `.local` removed pnpm, the sole permitted repair is `corepack prepare pnpm@11.9.0 --activate`, followed by version verification. If Node or Git is broken, STOP.
5. In `destiny-product`, run exactly one `pnpm install --frozen-lockfile` and exactly one build. `npm install` is forbidden. Any failure is a hard STOP, not a retry.
6. Verify recorded sha256 values for `package.json` and `pnpm-lock.yaml` are unchanged and the build stamp contains exact pinned SHA/tree with `source=git`.
7. Run the previously approved prepublish route, auth, receipt, security, and Supabase checks. Any failure is a hard STOP.
8. Prune only `destiny-product/.next/cache`. Record per-path sizes and require `du -sh /home/runner/workspace` to be at most `3.0 GiB`. A larger workspace is a hard STOP with no publish.
9. Execute exactly one Replit publish. Replit Agent and any retry are forbidden.

Authorized attempt budget after cleanup: one frozen install, one build, and one publish. Any failure, including a transient network failure, consumes its corresponding allowance and stops execution.

### 5. Postchecks, rollback, and truthful boundary

If Bundle fails again before Promote, production remains unchanged: freeze, capture publish logs and size evidence, report, and seek a new D-REPLIT-BUNDLE-REMEDIATION-8 decision. Do not retry.

If Promote succeeds, require: live production health; authenticated `/api/version` serving exact SHA `082c70f1aecc8d3c395ea12f3542bd146fc57a01` and tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`; working authentication; zero 5xx on touched routes; passing authenticated and unauthenticated `keyword_serp` behavior; and healthy Supabase `seo-research` v13 with `verify_jwt=true`. A passing publish and `keyword_serp` postcheck flips keyword research to GO under D-LAUNCH-READINESS-1 only; it authorizes no broader launch claim.

If Promote succeeds but any postcheck fails, roll back through Replit to prior deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d`, verify prior production and authentication are serving, STOP, and report. If rollback controls are unavailable, escalate immediately with no forward fix.

### 6. Evidence and outcome record

Required evidence: this decision PR URL and merge SHA; required check URLs at the final PR SHA; `.replit` target proof; baseline and post-cleanup size table; exact HEAD/tree and clean-state outputs; pnpm version; package/lock hashes; build stamp; prepublish results; publish receipt and deployment identity; postchecks or failure evidence; and any rollback receipt. After execution, one follow-up protected docs-only PR must append the outcome to this entry. No completion claim is permitted before that outcome PR and evidence exist.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No cleanup, install, build, or publish before its merge.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision: D-REPLIT-BUNDLE-REMEDIATION-8

[2026-08-28] D-REPLIT-BUNDLE-REMEDIATION-8
Title: Stop the live workspace writer, finish the bounded Replit cleanup, restore the pinned pnpm toolchain, and authorize one production retry.
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — frozen Replit production surface, toolchain repair, and governed remediation of a failed cleanup.
Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No further Replit write before its merge and exact merge-SHA harness success.

### A. Immutable facts

The pinned application artifact remains commit `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, tree `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. Production remains unchanged on deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d`. Workspace process changes cannot modify that separate live deployment.

D7 was properly recorded through PR #49, labeled `cto-approved` by `joseangelo510`, protected-merged at `9fb6c1b2bc73936c84bb5eacbfd5bb0d8f6b281f`, with exact merge-SHA harness run `33189440317` successful.

The single D7 cleanup command exited nonzero because a live Turbopack writer kept `/home/runner/workspace/.next/dev/cache/turbopack` nonempty. The first three ordered paths — root `.cache`, `.local`, and `node_modules` — were removed; root `.next` remained partial; `destiny-product/node_modules` and `destiny-product/.next` were not reached. The cleanup allowance was consumed. No install, build, or publish allowance was used.

Post-failure checks still showed the pinned HEAD/tree and an empty Git status. Removing `.local` removed Corepack from PATH. Replit/Nix displayed an interactive package-selection prompt, which Codex cancelled without selecting or installing anything.

### B. Determinations and supersession

D8 supersedes and voids every unused D7 allowance once this decision is recorded. D8 is then the sole authorization. It permits targeted termination of the workspace dev/Turbopack writer, bounded re-deletion of only the three remaining allowlisted paths, user-local restoration of Corepack and pnpm `11.9.0`, and one frozen install, build, and republish attempt. It does not authorize a new deployment, a Repl reboot, tracked-file or runtime-config changes, or any Replit/Nix package selection.

### C. Authorized writes

- Append this decision and the later outcome record to `destiny-product/DEPLOY_LOG.md` through protected docs-only PRs.
- Send SIGTERM, and only if necessary after a ten-second recheck SIGKILL, to individually enumerated workspace dev/Turbopack writer PIDs.
- Remove exactly `/home/runner/workspace/.next`, `/home/runner/workspace/destiny-product/node_modules`, and `/home/runner/workspace/destiny-product/.next`.
- Write only untracked user-home locations required for the toolchain repair: `~/.npmrc`, `~/.local/**`, `~/.cache/**`, and npm/Corepack cache directories.
- Run one `pnpm install --frozen-lockfile`, one verbatim `.replit` build, and one republish of the existing deployment.

### D. Forbidden actions

Do not answer any interactive Nix/Replit package prompt. Do not edit `.replit`, `replit.nix`, shell rc files, secrets, environment files, or any tracked application file. Do not use `nix profile install`, `nix-env`, switch or install Node versions, remove anything outside the three remaining paths, mutate Git in the Replit workspace, create or duplicate a deployment, change deployment configuration or secrets, use Replit Agent or Fix with Agent, or retry beyond the budgets below.

### E. Ordered execution

1. Record D8 in a docs-only PR, have `joseangelo510` apply `cto-approved`, require all final-PR checks green, protected-merge it, and require the exact merge-SHA harness run to succeed before another Replit write.
2. Read-only verify pinned HEAD/tree, empty `git status --porcelain`, and working `node --version` and `git --version`. Any mismatch or failure is a hard STOP.
3. Enumerate workspace processes with `ps -eo pid,ppid,etime,command | grep -Ei 'next|turbopack|node|pnpm' | grep -v grep`. Send SIGTERM to each confirmed writer individually, excluding PID 1, the current shell and its ancestors, and every Git/SSH process. Wait about ten seconds and re-enumerate. Send SIGKILL only to the same still-present writer PIDs. If writers respawn after two complete passes, STOP.
4. Remove the three remaining paths one command at a time in this order: root `.next`, `destiny-product/node_modules`, `destiny-product/.next`. Verify each is absent with `ls -d`. If one path fails again because of a live writer, one additional attempt of only that path is permitted after repeating the process-stop step successfully; otherwise STOP. Reverify pinned HEAD/tree and clean Git.
5. Restore the toolchain only by exporting `$HOME/.local/bin` first in the session, requiring `npm --version` to succeed, recording `npm config get prefix`, setting the npm prefix to `$HOME/.local`, running `npm install -g corepack` once, verifying `corepack --version`, running `corepack prepare pnpm@11.9.0 --activate`, and requiring both `corepack pnpm --version` and `pnpm --version` to print exactly `11.9.0`, with `pnpm` resolving under `$HOME/.local`. Any nonzero exit, unexpected version, or interactive prompt is a hard STOP. Reverify pinned HEAD/tree and clean Git.
6. In the directory containing `pnpm-lock.yaml`, run exactly one `pnpm install --frozen-lockfile`. Any failure or lockfile mutation is a hard STOP.
7. Execute the verbatim build command from `.replit` exactly once. Reverify byte-identical tracked state and the pinned HEAD/tree.
8. Record `du -sm /home/runner/workspace`, `destiny-product/.next`, and every `node_modules`. The workspace must be at most `6144 MB`; a larger result is a hard STOP.
9. Run the approved prepublish checks. Then republish the existing Replit deployment once with no configuration change. Run production route, zero-5xx, authentication, version, `keyword_serp`, and Supabase postchecks.

### F. Attempt budget, stop, rollback, and claim boundary

D8 authorizes one Corepack install, one frozen pnpm install, one build, and one publish. Every nonzero exit or ambiguous state consumes the corresponding allowance and requires STOP. No ungoverned retry exists.

Universal stop conditions include broken Node or Git, artifact or tracked-tree drift, any interactive prompt, missing npm, pnpm not exactly `11.9.0`, lockfile mutation, build failure, size-gate breach, publish error, unavailable required evidence, or any ambiguity.

Production remains on the current build until republish succeeds. If republish or any required postcheck fails after promotion, re-promote the prior successful deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d` through Replit's previous-deployment restore exactly once, verify it, STOP, and report. If restore is unavailable or fails, STOP without a forward fix.

A successful republish proves runtime parity with the pinned main artifact only. Passing `keyword_serp` may flip keyword research to GO under D-LAUNCH-READINESS-1; it does not authorize a broader launch claim.

### G. Required completion evidence

Record the decision PR URL, `cto-approved` label, merge SHA, final check URLs, and exact merge-SHA harness receipt; full Step 2 through Step 9 command transcripts and exit codes; process lists before/after; absent-path proofs; Node/npm/Corepack/pnpm versions; package and lock hashes; build stamp; Git identity and clean-state checks; size measurements; prepublish results; publish receipt and deployment identity; production/postcheck results; and any rollback receipt.

After execution, append the outcome through a second protected docs-only PR with the same approval, merge, and green-check standard. Complete means the D8 decision PR is merged green, the bounded execution finishes within budget, production is postchecked or rolled back and reported, and the outcome PR is merged green at its merge SHA.

Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No further Replit write before its merge and exact merge-SHA harness success.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision supplement: D8.1-CONT through D8.4b-CONT

[2026-08-28] D8.1-CONT, D8.2-CONT, D8.3-CONT, D8.4-CONT, D8.4a-CONT, and D8.4b-CONT
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — deterministic package-manager and effective Replit runtime-configuration remediation.
Status: DECIDED — AWAITING PROTECTED CONFIG-GOVERNANCE PR. No dependency install, build, run, or publish is authorized before its protected merge, exact merge-SHA harness success, new artifact pin, and D8.5 execution decision.

### A. Stops and environment provenance

The D8 execution correctly stopped before project dependency installation, build, or publish when `pnpm` first resolved to `/home/runner/workspace/.config/npm/node_global/bin/pnpm` instead of a user-local pinned shim. Removal of the stale `pnpm` and `pnpx` symlinks exposed Replit's lower Nix pnpm `10.26.1`, and removal of the stale Corepack shim exposed Nix Corepack `0.34.0`. These were nonconforming fallback paths, not acceptable release provenance.

Read-only npm diagnostics showed the effective prefix remained `/home/runner/workspace/.config/npm/node_global`; the configured user prefix `/home/runner/.local` was reported as overridden by environment. Git porcelain remained empty. D8.3-CONT therefore authorized one command-line-prefix-pinned install of Corepack `0.34.7` under `/home/runner/.local`, followed by `corepack enable --install-directory /home/runner/.local/bin` and activation of pnpm `11.9.0`. Verification passed:

- `command -v corepack` -> `/home/runner/.local/bin/corepack`; `corepack --version` -> `0.34.7`
- `command -v pnpm` -> `/home/runner/.local/bin/pnpm`; `pnpm --version` -> `11.9.0`
- pre-install workspace size -> `353 MB`, below the binding `6144 MB` gate
- pinned Replit HEAD -> `082c70f1aecc8d3c395ea12f3542bd146fc57a01`; Git porcelain empty

The lower Nix binaries and inert old-prefix Corepack library residue are left untouched. Any pnpm invocation in the eventual D8.5 execution must first reassert `/home/runner/.local/bin/pnpm` at exactly `11.9.0` in the same shell.

### B. Canonical package manager and lockfile

Pinned-tree evidence showed both `destiny-product/package-lock.json` and `destiny-product/pnpm-lock.yaml`. Last-touch evidence was:

- `destiny-product/package.json`: `082c70f1aecc8d3c395ea12f3542bd146fc57a01`, `2026-08-28T03:28:20-07:00`
- `destiny-product/package-lock.json`: `4cbb139d7783c5e3573bdd8b5b5ca55a00c2f3f7`, `2026-08-22T08:44:48-07:00`
- `destiny-product/pnpm-lock.yaml`: `53f18c2194d681c7c168008464d4d37eb10ed843`, `2026-08-22T09:01:43-07:00`

The manifest declares `packageManager: pnpm@11.9.0`; CI and staging already install pnpm `11.9.0` and use `pnpm install --frozen-lockfile`; exact-main harness run `33191216200` succeeded on the frozen pnpm path. The manifest diff since the pnpm-lock touch changed only build and QA scripts and no dependency-bearing field. D8.4a-CONT therefore selected R0: pnpm `11.9.0` is canonical, `pnpm-lock.yaml` is semantically current and must not be regenerated, and `package-lock.json` is the orphan that must be deleted.

Permanent no-mixed-manager rule: Destiny tracks exactly one application lockfile, `destiny-product/pnpm-lock.yaml`, and application dependency installation in Replit, CI, staging, documentation, and release execution uses pnpm only.

### C. Effective Replit configuration governance

The pinned commit did not contain root `.replit` (`git show 082c70f1:.replit` exited `128`) even though `/home/runner/workspace/.replit` was the effective Replit build/deploy configuration. `git check-ignore -v .replit` identified the tracked root `.gitignore` catch-all rule as the ignore source. The effective file hash before governance was `cdd50b7a73bba292f2ff21278433f0d5a6e4e754e48e6eb7ff5eebdbbeadd2f1`. The tracked `destiny-product/.replit` was an inert subdirectory copy and did not include all effective root workflow, post-merge, port, or Nix configuration.

D8.4b-CONT establishes the permanent single-config rule: exactly one `.replit`, at repository root, tracked, pinned, and harness-covered. This PR must:

1. add `!/.replit` to the tracked root `.gitignore` allowlist;
2. add the effective root `.replit` configuration, preserving every existing line except replacing all npm/npx invocations with pnpm equivalents and setting the build to `cd destiny-product && pnpm install --frozen-lockfile && pnpm run build`;
3. delete inert `destiny-product/.replit`;
4. delete orphan `destiny-product/package-lock.json`;
5. append this decision supplement only.

No other path is authorized. The pnpm lockfile ships byte-identically.

### D. Merge, pin, and execution boundary

The config-governance PR requires branch protection, the `cto-approved` label applied by `joseangelo510`, all final PR checks green, protected merge, and an exact merge-SHA harness success. After merge, the Replit workspace may fast-forward to the new main only if the old-to-new diff lists exactly the five scoped paths above, Git remains clean, and the effective disk `.replit` hash is byte-identical to `git show HEAD:.replit | sha256sum`.

The resulting commit and tree become the new pinned artifact, superseding `082c70f1aecc8d3c395ea12f3542bd146fc57a01` and `324cd92ca0d06ddb20beb9a16384010a8b2cd541`. D8.4b-CONT authorizes no dependency install for building, no build, no run, and no publish. Fable 5 High must issue D8.5 against the new green pin before the single controlled build/publish sequence.

Status: DECIDED — AWAITING PROTECTED CONFIG-GOVERNANCE PR, EXACT-MERGE HARNESS, NEW PIN, AND D8.5.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## CTO production decision supplement: D8.4c-CONT

[2026-08-28] D8.4c-CONT, successor to D8.4b-CONT under D-REPLIT-BUNDLE-REMEDIATION-8
Issued by: Fable 5 High, acting CTO of record for Destiny, under `HARNESS_POLICY.md` GOV-1.
Classification: HIGH — canonical-lockfile security-test alignment discovered at pre-open verification.

The five-path scope approved by D8.4b-CONT would have failed the exact-main harness after deletion of `destiny-product/package-lock.json`: tracked test `destiny-product/qa/rules/document-export-security.test.ts` still opened the deleted npm lockfile and asserted the nanoid security pin in both lockfiles. Codex found this contradiction during pre-open verification, before creating the PR. D8.4c-CONT therefore widened the protected PR to exactly six paths and retained the identical supply-chain invariant against the canonical pnpm lockfile instead of preserving mixed-manager state for a test fixture.

Read-only evidence, recorded verbatim:

```text
$ grep -nE 'nanoid' destiny-product/pnpm-lock.yaml
8:  nanoid: 3.3.18
2224:  nanoid@3.3.18:
4617:      nanoid: 3.3.18
5030:  nanoid@3.3.18: {}
5185:      nanoid: 3.3.18

$ grep -nE '"nanoid"' destiny-product/package.json
10:    "nanoid": "3.3.18",

$ grep -nE '"overrides"|"pnpm"' destiny-product/package.json
9:  "overrides": {
```

Decision path: Variant V2. The canonical lockfile contains `nanoid@3.3.18`, contains no `nanoid@3.3.16` or `nanoid@3.3.17`, and the manifest contains an `overrides.nanoid` pin at `3.3.18`. The test removes all npm-lockfile reads, renames its wording to the canonical pnpm lockfile, asserts the actual manifest override through `pnpm.overrides` or `overrides`, rejects the vulnerable releases, and requires `nanoid@3.3.18` in `pnpm-lock.yaml`. Unrelated Word-export sanitization assertions remain unchanged.

Amended exact PR scope: `.gitignore`, new root `.replit`, deleted `destiny-product/.replit`, deleted `destiny-product/package-lock.json`, `destiny-product/DEPLOY_LOG.md`, and `destiny-product/qa/rules/document-export-security.test.ts`. Any seventh path is forbidden; `destiny-product/pnpm-lock.yaml` remains byte-identical under R0.

Nothing in D8.4c-CONT authorizes dependency installation, build, run, or publish in Replit. Protected merge still requires the `cto-approved` label, all final PR checks green, protected merge, and exact merge-SHA harness success. D8.5 remains the sole execution decision after the new green pin and root `.replit` disk-to-pin hash identity check.

Status: DECIDED — AWAITING EXACT-SIX-PATH PROTECTED PR, EXACT-MERGE HARNESS, NEW PIN, AND D8.5.
Decided by: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1.

## 2026-08-29 — DECISION RECORD: D9.0-REBRAND-REBOUND

**Decision ID:** `D9.0-REBRAND-REBOUND`
**Authority:** Fable 5 High (Claude), on request of Jose Gallegos
**Classification:** HIGH — covers frozen actions: release tag creation; auth-surface configuration; parallel-launch production change; `container-staging` pushes for this workstream; and this `HARNESS_POLICY.md` amendment
**Canonical base:** `0f43eed77360921cbca43c081f39ff2f343593cc`
**Policy verified at:** `24c0ee825df6ca9359a4dfadf25779b15cef7ece` — reachable and active
**Decision source:** https://claude.ai/chat/7a177580-0665-4136-be13-08e0943fa12b

### Authorized scope

1. **Docs/policy PR (HIGH; `cto-approved` plus `policy-change`):** append this decision and amend `HARNESS_POLICY.md` to add `https://app.reboundseo.com` as a second parallel-launch domain alongside `https://app.caminoseo.com`.
2. **Rebrand PR (MEDIUM):** replace customer-facing strings with “Rebound SEO” across metadata, navigation and copy, login, onboarding, audit status text, sidebar and ARIA labels, visible errors, email subjects/bodies/display name, and exported-document metadata. Add display-layer mapping that renders persisted `Destiny Interviews` as `Rebound SEO Interviews`. Do not change environment-key names, authentication logic, crawler user agents, schema, or persisted data.
3. **Cutover PRs/actions (HIGH; this decision linked):**
   - Add Supabase allowed redirect URLs for `https://app.reboundseo.com` additively.
   - Set `NEXT_PUBLIC_SITE_URL` and `DESTINY_SITE_URL` to `https://app.reboundseo.com` in Fly runtime configuration only. Log key names, never secret values.
   - Add the Fly certificate and GoDaddy DNS records for `app.reboundseo.com` additively, including the required ACME CNAME and application CNAME or A record.
   - Create one immutable release tag for the certified rebrand build and deploy that tag to the Fly parallel-launch app.
   - Confirm Resend capacity for a second domain; verify `reboundseo.com` (prefer a send subdomain); change the from address only after verified test sends pass SPF, DKIM, and DMARC. Retain the Camino Resend domain for at least 30 days.

### Forbidden under this decision

- Supabase Auth Site URL changes.
- Any Replit modification, decommission, or traffic redirect.
- Database migrations or release-wrapper merges.
- Root `reboundseo.com` takeover or any change to its existing DNS or mail records.
- Deletion or replacement of Camino DNS, mail, or Resend records, or redirecting `app.caminoseo.com`.
- Crawler user-agent changes or persisted-data migration of `generatedBy` values.
- Direct-to-main work, unprotected or bypass merges, or deploys from unmerged branches.
- Secret-value disclosure or logging, or weakening any GOV-1 guard.

### Ordered gates

1. Merge the docs/policy PR through branch protection with `policy-guard`, `checklist-guard`, and `harness-gates` green.
2. Merge the rebrand PR after the full `pnpm gate`, a staging build stamp equal to the PR SHA, and zero 5xx responses on touched routes.
3. Add the Supabase allowed redirect URLs and log the evidence.
4. Require the Fly certificate to be Ready and DNS to be live while verifying that the root marketing page remains intact.
5. Create the release tag only after a full 79-route sweep and build-identity proof.
6. Deploy the tag to the parallel launch and record the consultation’s acceptance evidence items 1–11.

### Stop conditions

Stop on any red gate; any frozen surface touched outside authorized scope; canonical policy unreachable at the working SHA; any certificate or DNS anomaly affecting the root domain or mail records; any authentication journey failure; or any ambiguity. Re-escalate ambiguity to Fable 5 High.

### Rollback

Redeploy the prior immutable tag to Fly. If the failure is DNS- or certificate-scoped, remove only the new `app.reboundseo.com` records. Leave Camino and GoDaddy mail records untouched and never hand-edit production. Roll back on authentication, magic-link, or OAuth failure; TLS failure; any touched-route 5xx; email-deliverability failure; build-stamp mismatch; or disruption to the root marketing site.

**Status:** DECIDED — implementation authorized in phase order A -> B -> C. Completion requires protected merged PRs with merge SHAs and green `policy-guard`, `checklist-guard`, and `harness-gates` run URLs for each SHA, plus the enumerated acceptance evidence. D8.5 Replit remediation remains OPEN and is not advanced or closed by this decision.

**Supersession note:** D9.1 below supersedes D9.0 clauses on parallel operation, 30-day Camino coexistence, Camino retention, and Site URL deferral. The D9.0 topology, copy-scope boundaries, and root-domain preservation carry forward.

## D9.1-REBRAND-REBOUND-CUTOVER — Fable 5 High Decision

Decision ID: D9.1-REBRAND-REBOUND-CUTOVER
Date: 2026-08-29
Authority: Fable 5 High (Claude), executing the product decision of Jose
Gallegos, who has explicitly approved full replacement and live cutover.
Classification: HIGH (explicitly authorizes frozen actions: Supabase Auth
Site URL change; release tag creation; production/parallel-launch change;
container-staging pushes for this workstream; HARNESS_POLICY amendment)
Supersedes: D9.0-REBRAND-REBOUND clauses on parallel operation, 30-day
Camino coexistence, Camino retention, and Site-URL deferral. D9.0 topology
(root = marketing, app subdomain = product), copy-scope boundaries, and
root-domain preservation carry forward.
Context: pre-launch; no traffic to preserve; no company-email migration.
Policy verified at: 24c0ee825df6ca9359a4dfadf25779b15cef7ece (reachable).
Phase-A branch: codex/rebound-seo-policy @ 38c39eacfbeb90d9dfa428c62dea1ca14968ae9e
(PR #57), to be amended under this decision.

### Authorized scope and order

1. Amend and merge PR #57 (HIGH; labels `cto-approved` and `policy-change`
   applied by `joseangelo510`): record D9.1; amend `HARNESS_POLICY.md` to name
   `https://app.reboundseo.com` as the product/launch domain and remove the
   `app.caminoseo.com` parallel-launch clause.
2. Rebrand PR (MEDIUM) from post-merge `main`: customer-facing strings to
   “Rebound SEO” (metadata, navigation and copy, login, onboarding, audit
   status text, sidebar and ARIA labels, visible errors, email subjects,
   bodies, and display name, and exported-document metadata), plus a
   display-layer mapping for persisted “Destiny Interviews”. No environment
   key, schema, RLS, data, user-agent, or authentication-logic changes.
3. Supabase Auth: add `app.reboundseo.com` redirect allowlist entries
   additively, then set Site URL to `https://app.reboundseo.com`.
4. Add the Fly certificate and GoDaddy DNS for `app.reboundseo.com` (ACME
   CNAME plus application CNAME or A record; additive only).
5. Set Fly runtime configuration keys `NEXT_PUBLIC_SITE_URL` and
   `DESTINY_SITE_URL` to `https://app.reboundseo.com`. Log key names, never
   secret values.
6. Create one immutable release tag from the merged rebrand SHA; run the full
   suite, 79-route sweep, and build-identity proof; deploy the tag to Fly.
7. After all verification receipts pass, snapshot and then remove
   `app.caminoseo.com` from Fly certificates, Camino DNS (application A record
   and ACME CNAME only), and the Supabase redirect allowlist.

### Explicitly out of scope and preserved

- Replit. No Replit change is necessary for this cutover; Replit remains
  untouched and any Replit action requires a new decision.
- The root `reboundseo.com` Website Builder site and all existing
  `reboundseo.com` DNS, MX, SPF, DKIM, and DMARC records.
- All `caminoseo.com` mail and Resend verification records. Authentication
  email continues through the verified Camino Resend sender; only its display
  name becomes “Rebound SEO”.
- Database schema, RLS, product data, persisted `generatedBy` values, crawler
  user agents, and `DESTINY_*` key names.
- Email migration.

### Forbidden

- Direct-to-main work, unprotected or bypass merges, or deploys from unmerged
  branches.
- Secret disclosure.
- Deletion or modification of the preserved records above.
- Root-domain takeover.
- Weakening any GOV-1 guard.
- Any required label applied by an actor other than `joseangelo510`.

### Required evidence

Record all of the following against this decision ID: green `policy-guard`,
`checklist-guard`, and `harness-gates` run URLs for each merge SHA; both
protected-merge SHAs; release tag and tag SHA; Fly certificate Ready; DNS and
TLS receipts for `app.reboundseo.com`; DNS receipts showing pre-existing
`reboundseo.com` records unchanged; build stamp equal to the tag SHA; public
HTTP 200 and zero 5xx on touched routes; an end-to-end magic-link journey
landing authenticated on `app.reboundseo.com`; the root marketing page intact
with HTTP 200 and screenshot; and a pre-deletion Camino snapshot plus
post-removal confirmation.

### Stop conditions

Stop on any guard red after labels are applied; canonical policy unreachable
at the working SHA; any technically required change outside authorized scope;
certificate or TLS failure; magic-link failure; build-stamp mismatch; or any
ambiguity. Re-escalate HIGH.

### Rollback

Before Camino removal, revert the Supabase Site URL to its prior value,
redeploy the prior immutable tag, and optionally delete the two new DNS
records. After Camino removal, restore its certificate, DNS, and allowlist from
the pre-deletion snapshot, revert the Site URL, and redeploy the prior tag.
Never hand-edit production.

**Status:** DECIDED — implementation authorized in the order above. Completion
is claimed only with all required evidence recorded. D8.5 Replit remediation
remains OPEN and unaffected.

## D9.1a-DEPLOY-MECHANISM — Fable 5 High Addendum to D9.1

Decision ID: D9.1a-DEPLOY-MECHANISM
Date: 2026-08-29
Scope: execution mechanism for D9.1 step 6 only; D9.1 otherwise unchanged.
Classification: HIGH (frozen surfaces: release-wrapper merge to main; CI/
deploy workflow; production deploy — all executed once under this addendum).

DECIDED: Option A. A new protected HIGH wrapper PR from current main replaces
any use of the spent container-staging workflow, which is invalidated on every
pin (SHA fc7f050, tag step-zero-v1.1, Camino URL, 77 routes, zero-machine
candidate, exhausted run ceiling) and is left byte-identical, unrun, and out
of scope.

ORDER: (1) PR #58 (head e6e80a1) merges protected with green guards (MEDIUM
unless policy-guard flags HIGH, then cto-approved first); (2) immutable release
tag from the #58 merge SHA with full suite + 79-route sweep + build identity;
(3) branch codex/rebound-deploy-wrapper from post-#58 main:
workflow_dispatch wrapper hard-pinned to exact tag/SHA, existing GitHub
production secrets by name only, one-machine in-place Fly deploy to
destiny-production's single v2 machine, in-workflow inventory/build-stamp/
public-200/zero-5xx 79-route checks, and a rollback job redeploying the
recorded prior release; (4) wrapper PR is HIGH, cto-approved by
joseangelo510, guards green, protected merge; (5) prior Fly release/image
digest + machine ID captured before dispatch; (6) dispatch with tag; record
run URL, image digest, machine before/after, build-stamp, sweep, and 200
receipts.

ROLLBACK: dispatch the wrapper rollback job to redeploy the captured prior
image/tag; verify build stamp reverts. Triggers: stamp mismatch, any 5xx,
TLS/cert failure, magic-link failure. Never hand-edit production.

FORBIDDEN: secret reads; Replit, schema, RLS, mail changes; any
container-staging push; running/modifying the orphan workflow; force push or
admin bypass.

STATUS: DECIDED — Option A authorized; execution proceeds in the order above
under D9.1's evidence requirements.

D9.1b-ADDENDUM: The controlling invariant is the full committed route inventory at the deployed SHA — currently 80 routes per protected main and PR #58 QA — and the wrapper must dynamically derive, assert, and zero-5xx sweep every route in that inventory with none omitted, superseding the stale numeric "79" wherever it appears in D9.1/D9.1a.

D9.1c-ADDENDUM: D9.1 step 5's runtime-URL authorization is clarified to mean setting NEXT_PUBLIC_SITE_URL=https://app.reboundseo.com in the GitHub production build/Fly deployment and setting DESTINY_SITE_URL=https://app.reboundseo.com as a production Supabase Edge Function secret (key names logged, values of any secret never disclosed), since the Edge Functions — audit email links, rank-digest links, and the Google OAuth callback — read DESTINY_SITE_URL and the Fly Next app does not, so a Fly-only setting would leave emails/OAuth pointing at the old domain.

D9.1d-ADDENDUM: Option R1 is authorized — since the harness audits every commit and force push remains forbidden, branch `codex/rebound-deploy-wrapper` is unrecoverable in place; closing draft PR #59 without merge and leaving its remote branch untouched is authorized, as is creating `codex/rebound-deploy-wrapper-r2` from current protected main with the corrected commit sequence (DEPLOY_LOG alone first, then the new RED test alone under subject `red:`, then GREEN implementation alone), opening a new HIGH draft PR with `cto-approved` applied by `joseangelo510`, and proceeding only on green protected `policy-guard`/`checklist-guard`/`harness-gates`; no deploy, rollback, or provider change occurs under this addendum, and all D9.1a invariants (pinned tag/SHA, secrets by name only, one-machine in-place deploy, dynamic full-inventory zero-5xx sweep per D9.1b) carry forward unchanged to the r2 wrapper.

Execution baseline captured before dispatch:

- release tag: `rebound-seo-v1.0.0`
- shipped commit SHA: `fbd738c6508c9cde75231dea60acebe842eb0b6f`
- prior Fly machine ID: `860714be531938`
- prior Fly image digest: `sha256:e30c56dd27c8e3e7c28217cacb6eb82c3f08a2c81eedaa7d0e8da17b374af5bd`
- runtime key names authorized for replacement: `NEXT_PUBLIC_SITE_URL`, `DESTINY_SITE_URL`
- secret values: not read or recorded

D9.1e-ADDENDUM: Authorized — the failed run 33267220681 remains immutable; the wrapper's `sort -u` dedupe contradicted D9.1b's controlling invariant (sweep every committed inventory entry, none omitted, so 80 requests including both `/login` entries); recovery proceeds on `codex/rebound-deploy-wrapper-r3` from current protected main with the exact commit sequence (DEPLOY_LOG alone, then RED modification of the existing wrapper test alone requiring inventory-cardinality preservation and `sweep_count == inventory_count` with no dedupe, then GREEN workflow-only commit removing `sort -u` and asserting `route_count == inventory_count` both before and after sweep), a new HIGH draft PR with `cto-approved` applied by `joseangelo510`, green `policy-guard`/`checklist-guard`/`harness-gates`/staging on protected checks, protected merge, exact-main harness green, then redispatch of the same immutable `rebound-seo-v1.0.0` tag; no provider or live service changed, so no rollback is required, and all D9.1a–D9.1d invariants carry forward unchanged.

Failed dispatch receipt preserved before recovery:

- workflow run: `https://github.com/joseangelo510/destiny/actions/runs/33267220681`
- job: `https://github.com/joseangelo510/destiny/actions/runs/33267220681/job/99139317700`
- exact wrapper SHA: `01af4562c36f0b86a134400a04fdeb0bac2c4613`
- failing step: `Assert complete route inventory`
- failure fact: inventory entries `80`; unique URL paths `79`; duplicate inventory route `/login` represents both the page and its server-actions entry
- safety boundary: checkout and immutable-input assertions passed; all build, registry, secret-staging, Fly deploy, and post-deploy steps were skipped; production remained on `fc7f050e1201ff5ee6ebece98560592257de127f` / `step-zero-v1.1`

## D9.4-ROOT-TO-REPLIT-LANDING — Fable 5 High Decision

Decision ID: D9.4-ROOT-TO-REPLIT-LANDING
Date: 2026-08-29
Authority: Fable 5 High (Claude), executing the product decision of Jose
Gallegos
Decision source: https://claude.ai/chat/7a177580-0665-4136-be13-08e0943fa12b
Classification: HIGH (frozen: Replit production modification; root DNS
change)
Status: DECIDED — Authorized with correction.

Owner decision fixed: `reboundseo.com` must serve the existing Replit landing
page and that customer-facing Replit landing page must be named Rebound SEO.

Correction: GoDaddy URL forwarding to `destiny-seo.replit.app` is rejected
because it exposes the retired Destiny name in the visible URL and weakens
canonical URLs, shareability, and indexing. Implementation must use a Replit
custom-domain mapping that keeps the browser on `reboundseo.com`. Falling back
to URL forwarding is forbidden.

### Verified baseline

- `https://reboundseo.com` returns HTTP 200 but exposes only the GoDaddy
  Website Builder Contact Us page. The apex A records are
  `76.223.105.230` and `13.248.243.5`; `www` is a CNAME to the apex and its
  current certificate does not cover `www.reboundseo.com`.
- `https://destiny-seo.replit.app` returns HTTP 200 with the approved full
  landing-page narrative but still renders Destiny branding.
- Canonical `origin/main` at decision time is
  `54564d3ec339d2f3c78e594e1551709ee15602a9`; it contains the same full
  landing page rebranded throughout as Rebound SEO.
- The latest Replit publish failed with
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: Replit ran `npm install`, then
  the root `.replit` build invoked `pnpm install` without CI mode. An earlier
  attempt exceeded Replit's 8 GiB image-layer limit, so fixing the current
  blocker does not prove the publish will complete.
- `https://app.reboundseo.com` remains healthy on Fly. Supabase Site URL and
  sender are Rebound, and the Replit redirect allowlist entry remains.

### Authorized order

1. Merge this decision through a protected HIGH PR before any Replit or DNS
   change.
2. In the same PR, apply only the smallest deployment-config repair, starting
   with `CI=true pnpm install --frozen-lockfile`. If the 8 GiB image limit
   recurs, stop for a narrower packaging decision; do not improvise
   exclusions.
3. After green `policy-guard`, `checklist-guard`, `harness-gates`, staging
   build-stamp evidence, `cto-approved` by `joseangelo510`, and protected
   merge, republish only the approved merge SHA from canonical `54564d3`
   lineage to the existing Replit deployment. Preserve secrets, database,
   runtime settings, Supabase configuration, and project identity. Do not use
   Replit Agent edits.
4. Before DNS moves, verify the Replit root and `/login` return HTTP 200,
   render Rebound SEO with no visible Destiny branding on those
   customer-facing surfaces, and complete the existing auth journey.
5. Add `reboundseo.com` and `www.reboundseo.com` as custom domains on the
   existing Replit deployment. DNS changes are limited to Replit's specified
   apex A pair, `www` CNAME, and any required Replit TXT verification record.
6. Verify apex and `www` serve the Rebound landing page over valid TLS while
   the URL bar remains on `reboundseo.com`; `/login` works;
   `app.reboundseo.com` remains healthy; authoritative and public DNS prove
   mail records unchanged; and all touched surfaces have zero 5xx responses.

### Preservation boundary

Preserve byte-identical every MX, SPF, DKIM (including
`resend._domainkey.reboundseo.com` and all `send.reboundseo.com` records),
DMARC, and every `app.reboundseo.com` record. Do not change Supabase or Fly.
Do not change Replit secrets, database, runtime settings, or project identity.
D8.5 remains open; this decision authorizes only the republish and custom-domain
mapping above, not general Replit remediation.

### Stop conditions

Stop on 8 GiB recurrence; any other publish failure; unsupported custom
domains or verification failure; any required change to a preserved mail,
Resend, or application record; visible Destiny branding after republish; auth
failure; a red or missing required check; build-stamp mismatch; or ambiguity.

### Rollback

Restore apex A records `76.223.105.230` and `13.248.243.5` and the `www`
CNAME to the apex; remove the Replit custom-domain mapping; and restore the
prior Replit deployment revision if the republish itself must be reverted.
Never touch mail records, Supabase, or Fly.

### Required receipts

Record the protected PR URL, merge SHA, required guard run URLs, approved
republished revision/SHA, branding and auth evidence from step 4, DNS
before/after, valid TLS on apex and `www`, authoritative/public MX and TXT
preservation proof, application health, and the zero-5xx sweep.

## D9.5-REPLIT-RUN-COMMAND — Fable 5 High Decision

Decision ID: D9.5-REPLIT-RUN-COMMAND
Date: 2026-08-29
Authority: Fable 5 High (Claude), executing the product decision of Jose
Gallegos
Decision source: https://claude.ai/chat/7a177580-0665-4136-be13-08e0943fa12b
Classification: HIGH (frozen: Replit production modification)
Status: DECIDED — Authorized.

The protected D9.4 change merged as
`b73c09167b66564af1d8ad571f840e132a0beede` and was republished to the
existing Replit deployment as revision `2adb7dbe`. Provision, security,
build, bundle, and promote passed, including the former 8 GiB image-layer
gate. Runtime verification then stopped the cutover because both `/` and
`/login` returned HTTP 500. No custom domain or DNS record changed.

The runtime log proved that the configured command
`pnpm run start -- -H 0.0.0.0 -p 3000` executed as
`next start -- -H 0.0.0.0 -p 3000`. Next interpreted `-H` as a project
directory and exited with `Invalid project directory provided, no such
directory: /home/runner/workspace/destiny-product/-H`.

### Authorized change and order

1. Change only the root `.replit` run line to
   `run = "cd destiny-product && pnpm exec next start -H 0.0.0.0 -p 3000"`.
2. Carry the decision, RED config regression test, and one-line GREEN repair
   through a new protected HIGH PR with full CI green, `cto-approved` applied
   by `joseangelo510`, and protected merge.
3. Sync and republish only that exact merge SHA to the existing Replit
   deployment. Preserve project identity, secrets, database, Supabase, Fly,
   mail, custom-domain state, and all DNS. Do not use Replit Agent edits.
4. Verify the Replit root and `/login` return HTTP 200, render Rebound SEO
   without visible Destiny branding, and complete the existing auth journey.
5. Only after step 4 passes, resume the D9.4 custom-domain and DNS gates.

### Stop and rollback

Stop and re-escalate on any change beyond the single runtime line, recurrence
of HTTP 500, a new publish/runtime failure class, a touched preserved surface,
a red or missing required check, or ambiguity. If a working `replit.app`
origin is needed after a failed retry, republish the last known-good
pre-D9.4 SHA from the `1095526d` lineage; otherwise holding the failed Replit
origin is acceptable while no public domain depends on it. Never hand-edit
the running deployment.

### Required receipts

Record the protected PR and merge SHA, green guard URLs, republished revision
ID, HTTP 200 and branding/auth evidence for `/` and `/login`, and confirmation
that custom domains, DNS, mail, Supabase, Fly, and `app.reboundseo.com` stayed
unchanged before the D9.4 cutover resumes.

## D9.6-REBOUND-AUTH-CANONICAL-HOST — Fable 5 High Decision

Decision ID: D9.6-REBOUND-AUTH-CANONICAL-HOST
Date: 2026-08-29
Authority: Fable 5 High (Claude), executing the product decision of Jose
Gallegos
Decision source: https://claude.ai/chat/7a177580-0665-4136-be13-08e0943fa12b
Classification: HIGH (authentication-surface configuration; Replit
republish)
Status: DECIDED.

The isolated-client magic-link result of Supabase `/auth/v1/verify` HTTP 303
to `destiny-seo.replit.app/auth/confirm`, then `/auth/error`, is presumptively
a PKCE verifier-storage artifact because the verification request did not
share the initiating Chrome profile. A cookie-preserving same-profile retest
is authorized before any configuration change.

The canonical authentication redirect for flows initiated on
`reboundseo.com` must be `https://reboundseo.com`. Returning a customer to
`destiny-seo.replit.app` exposes the retired name in the address bar and is
the same defect class D9.4 rejected for URL forwarding.

### Authorized changes and order

1. Run and record the same-Chrome-profile diagnostic retest.
2. Add only the Supabase Auth redirect-allowlist entries
   `https://reboundseo.com/**` and `https://www.reboundseo.com/**`. Remove
   nothing. The Supabase Site URL remains `https://app.reboundseo.com`.
3. Set only the existing Replit deployment configuration key
   `NEXT_PUBLIC_SITE_URL=https://reboundseo.com`. Do not change
   `DESTINY_SITE_URL` or any other key.
4. Republish the existing Replit deployment from the exact already-approved
   D9.5 merge SHA `f285e1402dee06587cf6befeb933f69febc8ecc7`, because the
   `NEXT_PUBLIC_*` value is build-baked. Preserve the project, secrets,
   database, DNS, mail, Fly, and every other runtime setting; do not use
   Replit Agent edits.
5. Initiate a fresh magic-link flow on `reboundseo.com`, open the delivered
   Rebound SEO email in the same Chrome profile, and prove the authenticated
   session remains on `reboundseo.com`.

### Stop and rollback

Stop and re-escalate before configuration changes if the same-profile retest
fails under the current configuration; on any third change; on any prompt to
alter Supabase Site URL, `DESTINY_SITE_URL`, DNS, or mail; on any new publish
failure class; or on ambiguity. Hold `www` verification while TLS propagates,
without treating it as an apex blocker.

Rollback is to restore `NEXT_PUBLIC_SITE_URL` to its prior value and
republish the same SHA; the additive allowlist entries may be removed. Never
hand-edit the deployment.

### Required receipts

Record the diagnostic redirect chain; redirect allowlist before and after;
republished revision ID and exact SHA; the successful same-profile auth chain
ending in an authenticated session on `reboundseo.com`; the delivered sender
and subject; and proof that DNS, mail, Fly, Supabase Site URL,
`DESTINY_SITE_URL`, and `app.reboundseo.com` remained unchanged. Append the
outcome through the next protected docs-only HIGH PR.

## D9.7-PKCE-HOST-ALIGNMENT — Fable 5 High Decision

Decision ID: D9.7-PKCE-HOST-ALIGNMENT
Date: 2026-08-29
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH
Status: APPROVED — proceed with the two D9.6-named changes only.

### Basis

The D9.6 in-profile current-configuration test failed as its stop clause
anticipated. The link was initiated on `https://reboundseo.com/login`,
delivered from `Rebound SEO <auth@reboundseo.com>`, and clicked from Gmail in
the same Chrome profile. Supabase redirected to
`destiny-seo.replit.app/auth/confirm`, terminating at
`destiny-seo.replit.app/auth/error`. This confirms that the PKCE verifier is
cookie-scoped to `reboundseo.com` and absent on the configured callback host,
so the exchange cannot succeed under the current configuration. Nothing
changed after the failed diagnostic.

The two changes named in D9.6 align the callback host with the verifier host
and are the minimal sufficient fix. Supabase Site URL is not modified; the
republish remains the exact D9.5 merge SHA; no code, DNS, schema, RLS, mail,
Fly, or other frozen item changes.

### Authorized order

1. Add exactly `https://reboundseo.com/**` and
   `https://www.reboundseo.com/**` to the Supabase Auth redirect allowlist.
   Do not modify Site URL, and do not remove or edit an existing entry. Record
   before and after evidence.
2. Record the existing Replit deployment value for `NEXT_PUBLIC_SITE_URL`,
   then set only that key to `https://reboundseo.com`.
3. Republish the exact D9.5 merge SHA
   `f285e1402dee06587cf6befeb933f69febc8ecc7`. Stop before publishing if the
   platform cannot guarantee that exact SHA.
4. Request a fresh auth email from `https://reboundseo.com/login` and open it
   from Gmail in the same Chrome profile. Success requires an authenticated
   session on `reboundseo.com` with no `/auth/error`. Pre-change emails do not
   count.

### Stop conditions

Stop immediately and re-escalate as D9.8 if saving the allowlist would require
or trigger a Site URL change; the republish would build any SHA other than the
exact D9.5 merge or demands any change beyond the single environment key; the
post-change in-profile test fails; apex, `www`, `app.reboundseo.com`, or any
preserved record degrades; or any third change appears necessary.

### Rollback

Remove the two additive allowlist entries, restore `NEXT_PUBLIC_SITE_URL` to
its recorded prior value, and republish
`f285e1402dee06587cf6befeb933f69febc8ecc7`. No data, schema, or DNS rollback
is involved.

### Required receipts

Record the Supabase redirect list before and after with Site URL unchanged;
the Replit environment key before and after; the republish revision and exact
SHA; the post-change same-profile sender, initiating URL, final host/path, and
authenticated session state; and a statement that nothing else changed.

This decision authorizes only these two changes. It does not authorize an
existing-traffic redirect, Fly cutover, Site URL change, migration, tag, or
any other frozen action, and it makes no launch claim beyond
D-LAUNCH-READINESS-1.

## D9.8-REPLIT-CHECKPOINT-IDENTITY — Fable 5 High Decision

Decision ID: D9.8-REPLIT-CHECKPOINT-IDENTITY
Date: 2026-08-29
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH
Status: PROCEED — content identity proved; authentication test still required.

### Basis

The D9.7 configuration changes stayed inside their authorized scope. The
Supabase Site URL remained `https://app.reboundseo.com`; the redirect list
changed additively from two to four entries by adding only
`https://reboundseo.com/**` and `https://www.reboundseo.com/**`. The Replit
editor secret named `NEXT_PUBLIC_SITE_URL` changed from
`https://destiny-seo.replit.app` to `https://reboundseo.com`, and no other
editor secret changed.

Before republishing, the Replit workspace contained the approved GitHub
commit `f285e1402dee06587cf6befeb933f69febc8ecc7`. Both deploy-input checks
returned zero:

1. tracked differences from `f285e140` under root `.replit` and
   `destiny-product`;
2. untracked files under those same paths.

Replit republished successfully. Its internal checkpoint commit became
`17dcff063a63f0e4adf51d7a41261fcbdeb32eaa`, while `/api/version` retained the
exact prior D9.5 application tree
`34d213d31a3e9992dcce4daed3232b6b0b898fb3`. The SHA difference is therefore
checkpoint metadata, not source divergence: a Git tree hash is
content-addressed over the deployed file tree, whereas a commit hash also
includes parent and author metadata. All apex, `www`, Replit-origin, and
`app.reboundseo.com` root and login probes returned HTTP 200.

### Authorized next step and stop conditions

Proceed only with the already-authorized fresh same-Chrome-profile magic-link
test. Success requires an authenticated Rebound session and no `/auth/error`.
Stop if the email redirects to `destiny-seo.replit.app`, the deployed tree
changes from `34d213d3`, any HTTP probe regresses, or the four-entry Supabase
state changes. Any additional remediation requires a new Fable 5 High
decision.

## D9.9-REPLIT-PUBLISHING-SITE-URL — Fable 5 High Decision

Decision ID: D9.9-REPLIT-PUBLISHING-SITE-URL
Date: 2026-08-29
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH (frozen: Replit production configuration and republish)
Status: PROCEED — one Publishing-pane variable correction authorized.

### Trigger and root cause

The D9.8 fresh request was initiated from
`https://reboundseo.com/login` at `2026-08-29T23:12:51Z`. Gmail delivered the
expected subject `Your Rebound SEO sign-in link` from
`Rebound SEO <auth@reboundseo.com>`, but the new link still contained
`redirect_to=https://destiny-seo.replit.app/auth/confirm?next=%2Fapp`. It was
not clicked.

Read-only diagnosis proved a Replit configuration-surface mismatch rather
than a code defect. `src/app/login/actions.ts` reads
`process.env.NEXT_PUBLIC_SITE_URL` when constructing `emailRedirectTo`, and
the production documentation states that editor secrets do not automatically
carry into the published app. D9.7 changed the editor secret, while the
Publishing-pane variable remained stale. No code, Supabase, DNS, mail, or Fly
change is needed.

### Authorized order

1. Record the current Publishing-pane `NEXT_PUBLIC_SITE_URL` value verbatim.
   Stop if it is absent, already `https://reboundseo.com`, or is not the stale
   site URL expected by the diagnosis.
2. Set only the Publishing-pane `NEXT_PUBLIC_SITE_URL` value to
   `https://reboundseo.com`. Leave the editor secret, `DESTINY_SITE_URL`,
   Supabase Site URL and allowlist, code, DNS, mail, Fly, and every other key
   unchanged.
3. Verify the publish tree still hashes to
   `34d213d31a3e9992dcce4daed3232b6b0b898fb3`, then republish that exact tree.
4. Request a fresh magic link in the same Chrome profile. Success requires the
   expected sender and subject, a `redirect_to` on `reboundseo.com`, an
   authenticated `reboundseo.com` session, no `/auth/error`, and no
   `destiny-seo.replit.app` hop.

### Stop and rollback

Stop on any source-tree drift; any prompt to change a second variable; a
publish failure; a non-200 customer route; or another fresh link with the old
host. Do not iterate on a second override source without a new decision.

Rollback is limited to restoring the exact Publishing-pane value recorded in
step 1 and republishing the same tree. No other rollback is authorized.

### Required receipts

Record the Publishing-pane value before and after, the unchanged tree hash,
the successful Replit revision, the fresh email sender and subject, the
callback and final authenticated host/path, and preservation checks. Append
the final outcome through a protected HIGH receipt PR.

This decision authorizes no code, Site URL, allowlist, `DESTINY_SITE_URL`, DNS,
mail, Fly, migration, tag, or broader launch-readiness change.

## D9.10-REPLIT-PUBLISHING-COMMIT — Fable 5 High Decision

Decision ID: D9.10-REPLIT-PUBLISHING-COMMIT
Date: 2026-08-29
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH (frozen: Replit production configuration and publish)
Status: PROCEED — commit the single approved Publishing-pane draft through
the page-level Publish action.

### Trigger and root-cause assessment

D9.9 was merged through protected PR #66 at
`1c0f7a504b6bb64b242e05716976c597bd159c5a`. In Replit Publishing > Adjust
settings, the persisted `NEXT_PUBLIC_SITE_URL` row showed the expected stale
value `https://destiny-seo.replit.app`. Only that row was edited to
`https://reboundseo.com`; the row-level Add action completed and the pane
displayed the new value. The page-level Publish action was not used. A
connector republish then completed successfully as deployment
`a5e94a27-6ca6-4f32-a8a7-08e671bf965d`.

The connector publish retained the exact approved source tree
`34d213d31a3e9992dcce4daed3232b6b0b898fb3`; tracked and untracked drift were
both zero, `/api/version` reported build SHA
`05cafcc4ada1a09b378c224eb7300ae686bc8eb5`, and all eight apex, `www`,
Replit-origin, and `app.reboundseo.com` root/login probes returned HTTP 200.
However, a fresh `2026-08-29T23:41:19Z` email from
`Rebound SEO <auth@reboundseo.com>` with subject
`Your Rebound SEO sign-in link` still contained
`redirect_to=https://destiny-seo.replit.app/auth/confirm?next=%2Fapp`. The
link was not clicked.

The evidence supports a settings-persistence failure: row-level Add updated
the Adjust settings draft, while the omitted page-level Publish action left
the deployment's persisted configuration stale. The connector therefore
republished correct code with the prior production value. This is not a code,
Supabase, DNS, mail, Fly, or second-secret defect.

### Authorized order

1. Merge this governance-only decision through a protected HIGH PR and record
   its merge SHA before another live change.
2. Reopen Replit Publishing > Adjust settings and capture the currently
   persisted `NEXT_PUBLIC_SITE_URL` value before editing anything.
3. If it already reads `https://reboundseo.com`, make no row edit and proceed
   to the page-level Publish action. If it remains stale, edit only this row
   to exactly `https://reboundseo.com`, use the row-level Add action, then use
   the page-level Publish action. No other row, secret, or setting may change.
4. After publishing succeeds, require `/api/version` tree
   `34d213d31a3e9992dcce4daed3232b6b0b898fb3` and HTTP 200 from all eight
   apex, `www`, Replit-origin, and `app.reboundseo.com` root/login probes.
5. Request a fresh same-profile magic link. Inspect its `redirect_to` before
   clicking. Only a link beginning
   `https://reboundseo.com/auth/confirm` may be opened. Complete the journey
   through an authenticated `https://reboundseo.com/app` session.

### Stop conditions

Stop and obtain a new decision if any other row is modified, absent, or
unexpected; the page-level Publish action surfaces a code diff or any change
beyond the single environment row; the source tree changes; any of the eight
probes is non-200; the magic link still names `destiny-seo.replit.app`; the
Supabase exchange fails; or any DNS, Fly, `DESTINY_SITE_URL`, mail, Supabase,
or second-secret change appears necessary.

### Rollback

If the page-level publish degrades service or post-publish verification fails,
restore `NEXT_PUBLIC_SITE_URL` to `https://destiny-seo.replit.app`, use the
page-level Publish action, and reverify the same tree and eight probes. The
connector deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d` is the known-good
functional baseline. A new decision is required before another remediation
attempt.

### Required receipts

Record this protected PR URL, green check-run URLs, and merge SHA; the
persisted production value before and after; the successful Replit deployment
ID; the post-publish `/api/version` output; timestamped eight-route probes;
the fresh email timestamp, sender, subject, and full callback host/path; and
the authenticated final `https://reboundseo.com/app` session. Append the
execution outcome through the final protected HIGH receipt PR.

This decision authorizes only committing the single Replit production value
through the page-level Publish action and the scoped verification above. It
does not authorize code, Supabase, DNS, mail, Fly, `DESTINY_SITE_URL`, a
second secret, migration, tag, traffic redirect, or broader launch claim.

## D9.11-REBOUND-ROOT-CUTOVER-FINAL — Execution Receipt

Decision ID: D9.11-REBOUND-ROOT-CUTOVER-FINAL
Date: 2026-08-29
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH (frozen: production configuration, domain, and auth)
Status: COMPLETE — scoped root-domain cutover and authenticated-root-host
verification succeeded; no further live change is authorized.

### Protected decision receipt

D9.10 was merged through protected PR #67,
<https://github.com/joseangelo510/destiny/pull/67>, at squash merge
`bff124805647fe483603f2094f0c8e955b2d27b2`. The required protected checks
were green:

1. harness:
   <https://github.com/joseangelo510/destiny/actions/runs/33281799032/job/99178087211>;
2. HIGH checklist:
   <https://github.com/joseangelo510/destiny/actions/runs/33282022807/job/99178664954>;
3. HIGH policy:
   <https://github.com/joseangelo510/destiny/actions/runs/33282022781/job/99178664859>;
4. staging:
   <https://github.com/joseangelo510/destiny/actions/runs/33282022881/job/99178665326>.

### Replit production execution

Replit Publishing > Adjust settings showed the persisted production value
`NEXT_PUBLIC_SITE_URL=https://destiny-seo.replit.app` before execution. Only
that row was edited. After the row-level Add action it read
`NEXT_PUBLIC_SITE_URL=https://reboundseo.com`, and the page-level Publish
action committed the draft. No second variable, secret, code file, DNS
record, Supabase setting, mail setting, or Fly setting changed.

The page-level publish completed successfully as Replit revision `448050df`.
The reserved-VM deployment ID remained
`a5e94a27-6ca6-4f32-a8a7-08e671bf965d`. A post-publish read confirmed the
persisted production value remained `https://reboundseo.com`. The live
version endpoint returned:

```json
{"sha":"8229546c2f5cd9e172a9461288cc460cf1989466","tree":"34d213d31a3e9992dcce4daed3232b6b0b898fb3","builtAt":"2026-08-29T23:59:23.049Z","env":"unknown"}
```

The content-addressed application tree therefore remained exactly the
approved `34d213d31a3e9992dcce4daed3232b6b0b898fb3`.

### Route, brand, DNS, and service preservation

Immediately after the publish, all eight scoped customer routes returned
HTTP 200:

1. `https://reboundseo.com/`;
2. `https://reboundseo.com/login`;
3. `https://www.reboundseo.com/`;
4. `https://www.reboundseo.com/login`;
5. `https://destiny-seo.replit.app/`;
6. `https://destiny-seo.replit.app/login`;
7. `https://app.reboundseo.com/`;
8. `https://app.reboundseo.com/login`.

The public apex and `www` root/login HTML contained zero customer-facing
`Destiny` matches and retained Rebound SEO branding. DNS remained scoped as
intended: apex and `www` resolved to `34.111.179.208`,
`app.reboundseo.com` remained at `66.241.125.157`, MX remained GoDaddy
`smtp.secureserver.net` plus `mailstore1.secureserver.net`, SPF remained
`v=spf1 include:spf.em.secureserver.net ?all`, DMARC remained
`v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;`,
and the Replit verification TXT remained present.

### Authenticated-root-host verification

> **Rebound SEO root-domain cutover — final verification receipt (Fable 5 High, frozen decision authority).**
> Verified at tree `34d213d31a3e9992dcce4daed3232b6b0b898fb3`: publish succeeded with `NEXT_PUBLIC_SITE_URL=https://reboundseo.com`; all eight apex/www/Replit-origin/app root and login probes returned HTTP 200. Fresh magic link (2026-08-30T00:04:35Z) from Rebound SEO <auth@reboundseo.com> carried `redirect_to=https://reboundseo.com/auth/confirm?next=%2Fapp`; the Supabase exchange completed with no `/auth/error` and no old-host hop; the session authenticated on `https://reboundseo.com`.
> **Recorded deviation:** the final landing path was `https://reboundseo.com/onboarding`, not `/app`, because this test account has not completed required onboarding; a direct visit to `/app` redirected to `/onboarding` by expected authenticated product logic. The `/app` render itself was not observed and is not claimed.
> **Scope:** this receipt attests authenticated root-host magic-link verification only. It authorizes no further change; all frozen items in `HARNESS_POLICY.md` remain frozen pending a new recorded Fable 5 High decision.

The fresh message sender, subject, callback host, and application UI all used
Rebound SEO. The test email remained in Gmail Spam because it was similar to
earlier messages classified as spam; inbox-placement remediation is outside
this cutover receipt and is not claimed.

### Final claim boundary

This receipt verifies the Rebound SEO landing page, production custom-domain
mapping, sender identity, and authenticated magic-link flow on the root host.
It does not verify a fully onboarded `/app` render, onboarding completion,
other accounts or mail providers, old-host decommissioning, deliverability
remediation, broader launch readiness, or any change outside the frozen
D9.10 execution scope.

### Local verification

The local gate passed repository policy, commit policy, deploy-log policy,
inventory generation (`80` routes and `764` interactive or mutation
surfaces), migration history, the governed audit, ESLint, and all `1,196`
Vitest tests across `188` files. It then stopped only because this host has no
Docker or Podman executable, so the local Supabase stack could not start.
Protected CI remains the authoritative replay for the container-backed gate.

## D10.2-REBOUND-REDESIGN-V1.1-RELEASE — Amendment 2

Issued by: Fable 5 High
Date: 2026-09-01
Status: Binding upon being recorded; supersedes the artifact pin in the
original D10.2 text and Amendment 1. This is an amendment to the same decision
ID, not a new decision.

### Finding

Artifact SHA `8730e82c53a5595b13109e5db085970f8e669aa1` is not safely
deployable: `supabase/functions/progress-report/index.ts` imports the bare
specifier `@supabase/server`, and the function has no colocated `deno.json`
providing the repository-standard mapping
`"@supabase/server": "npm:@supabase/server@1.4.1"`. Deploying the exact
artifact would fail or resolve nondeterministically; synthesizing an untracked
`deno.json` at deploy time would violate the exact-tagged-artifact
requirement. SHA `8730e82c53a5595b13109e5db085970f8e669aa1` is therefore
permanently unreleasable and marked superseded. No tag, production deployment,
workflow edit, or Fly mutation has occurred; nothing needs rollback.

### Disposition

1. PR #76 remains unmerged until a protected fix PR merges that adds only
   `supabase/functions/progress-report/deno.json` with the established mapping
   plus this Amendment 2 log entry, with the full harness and required checks
   green at the fix PR SHA. Merging PR #76 pinned to an undeployable artifact
   is prohibited.
2. The fix PR is classified HIGH. Although the diff is repository-only with
   no production mutation, it changes dependency resolution for a production
   Edge Function on the active release path and alters the artifact tree of an
   open HIGH release decision. This amendment is the required Fable 5 High
   recorded decision for it. With this amendment recorded, implementation is
   authorized as the exact one-file mapping above and nothing else.
3. There is no recursive governance. PR #76 may not self-authorize the fix;
   this Amendment 2 is recorded in the earlier fix PR and shares decision ID
   D10.2 because scope and intent are unchanged. Amendment 2 and the import map
   merge first; PR #76 is then updated to reference them.
4. After the fix merges, the new immutable release artifact is the fix PR
   merge commit on `main`. Record its full SHA and tree hash in PR #76, refresh
   exact-main evidence with every required check green at that new SHA, and
   replace the superseded SHA/tree throughout PR #76. Preserve tag name
   `rebound-seo-v1.1.0`; it will point at the new artifact. No tag currently
   exists.
5. All release-execution authorizations previously granted under D10.2 for
   SHA `8730e82c53a5595b13109e5db085970f8e669aa1` are revoked. Until the fix
   PR and then amended PR #76 are merged green, create no tag, deploy no
   production function, edit no production workflow, mutate no Fly production
   state, push no `container-staging` release, and redirect no traffic.

### Stop conditions

Stop and escalate to a fresh Fable 5 High decision if the fix PR diff contains
anything beyond `supabase/functions/progress-report/deno.json` and this log
entry; the mapping deviates from `npm:@supabase/server@1.4.1`; a required
check at the fix SHA is red, skipped, absent, or belongs to another SHA;
`verify_jwt`, relative dependencies, or another function file is touched; or
new audit facts affect deployability of the re-pinned artifact.

### Authorized recovery sequence

1. Record Amendment 2 in a protected fix PR that also adds the exact colocated
   import map. Never write directly to `main`.
2. Run the complete harness; merge only with `cto-approved` applied by
   `joseangelo510` and every required check green at the PR SHA; capture the
   run URLs.
3. Record the new artifact SHA and tree hash; refresh exact-main evidence at
   that SHA.
4. Update still-open PR #76 to the new SHA/tree and evidence; merge under the
   normal HIGH gates.
5. Only then proceed with the original D10.2 release sequence: tag
   `rebound-seo-v1.1.0`, deploy `progress-report` from the exact tagged
   artifact with `verify_jwt=true`, update the protected workflow pin, deploy
   Fly, and complete the original non-sending verification.

## D10.2-REBOUND-REDESIGN-V1.1-RELEASE — Fable 5 High Decision

Decision ID: D10.2-REBOUND-REDESIGN-V1.1-RELEASE
Date: 2026-09-01
Authority: Fable 5 High (Claude Code 2.1.186, model `fable`, effort `high`,
tools disabled), executing the product decision of Jose Gallegos
Classification: HIGH (release tag, production Edge Function, deployment
workflow, and Fly production)
Status: DECIDED — AWAITING PROTECTED DECISION-RECORD PR. No release action is
authorized before this entry merges with every required check green.

### Decision and immutable release scope

PROCEED, bounded to the strict sequence below. Release the protected redesign
artifact at commit `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`, tree
`cef9cda96ecb69869b2778ab931392448267fdf6`, to the existing Fly application
at `https://app.reboundseo.com` as annotated immutable tag
`rebound-seo-v1.1.0`. The release includes the first production deployment of
the exact `supabase/functions/progress-report` function from that artifact,
because the new Next route `/api/progress/report` invokes that function and
the production function inventory did not contain the slug at decision time.

The evidence basis is:

1. protected PRs #70 through #75 and the Amendment 2 import-map fix PR #77
   are merged;
2. the exact-main push harness is green at
   <https://github.com/joseangelo510/destiny/actions/runs/33502450039/job/99838680017>;
3. the redesign changed zero files under the existing tool routes
   `src/app/content`, `src/app/distribution`, `src/app/internal-links`,
   `src/app/keywords`, and `src/app/rank-tracker` relative to redesign base
   `14cbda0e36fe217892cdfd1e4946c036edfb1e55`;
4. the committed inventory contains 87 routes and 808 interactive or mutation
   surfaces; and
5. the current Fly release is `rebound-seo-v1.0.0` at
   `fbd738c6508c9cde75231dea60acebe842eb0b6f`, on machine
   `860714be531938`, with machine image digest
   `sha256:321828758e811bbc7bd25aea52a38e253e49b5d7d1402eb27553bc1ed93bb82b`.
   Its successful deployment receipt is
   <https://github.com/joseangelo510/destiny/actions/runs/33268238022/job/99142007848>
   and immutable evidence artifact is `9719348795`; the live build stamps
   agree with that release.

### Strict authorized order

1. Merge the governance-only PR containing this decision through branch
   protection, with `cto-approved` applied only by `joseangelo510` and every
   required check green at the PR SHA. No tag, function deploy, workflow edit,
   or production action may occur before this merge.
2. Re-fetch and prove `origin/main` is either
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213` with tree
   `cef9cda96ecb69869b2778ab931392448267fdf6`, or a governance-only descendant
   permitted by Amendment 1. Create annotated immutable tag
   `rebound-seo-v1.1.0` at exactly `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`.
   Any other drift or pre-existing tag with another target is a hard stop.
3. Before the function deploy, resolve the production Supabase project to
   exactly `etkksjebqgtkkdqznnxa` and prove it is healthy. Through a name-only
   secret inventory that does not read values, prove `RESEND_API_KEY`,
   `DESTINY_FROM_EMAIL`, and `DESTINY_SITE_URL` already exist. If any name is
   absent or values would need to be read or written, stop. Deploy only
   `supabase/functions/progress-report` from the tagged artifact to that
   project with `verify_jwt=true`, including its exact relative dependencies.
   Confirm the production inventory reports slug `progress-report`, active,
   and `verify_jwt=true`. The currently shipped Fly UI does not invoke this
   slug; any direct call remains JWT- and RLS-gated.
4. From post-decision protected `main`, create a branch and protected HIGH PR
   that changes only `.github/workflows/rebound-production-deploy.yml`,
   `Dockerfile`, and
   `destiny-product/qa/rules/rebound-production-wrapper.test.ts`. These are
   the manual production wrapper, its hard-coded build/runtime identity
   assertions, and its mechanical policy test. Release SHA/tag/image tag become
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`,
   `rebound-seo-v1.1.0`, and `rebound-seo-v1.1.0-prod`; the rollback point
   becomes machine `860714be531938`, image digest
   `sha256:321828758e811bbc7bd25aea52a38e253e49b5d7d1402eb27553bc1ed93bb82b`,
   SHA `fbd738c6508c9cde75231dea60acebe842eb0b6f`, tag
   `rebound-seo-v1.0.0`, and site URL `https://app.reboundseo.com`. No other
   workflow behavior is authorized. The Dockerfile may change only the two
   exact SHA/tag identity assertions to those release values. Merge only with
   `cto-approved` applied by `joseangelo510` and all required checks green.
5. Manually dispatch the merged workflow with action `deploy` and release tag
   `rebound-seo-v1.1.0`. Success requires one healthy Fly machine, a ready
   existing certificate, full committed-route inventory cardinality, zero
   5xx responses, and live build stamps equal to the release SHA, tag,
   production environment, and `https://app.reboundseo.com`.
6. Verify without sending email: an unauthenticated request to
   `/api/progress/report` must be rejected. Do not perform an authenticated
   report invocation or claim provider acceptance, delivery, or inbox arrival;
   a real send requires separate explicit authorization.

### Rollback and stop conditions

On any Fly post-deploy failure, run the protected rollback action exactly once
to restore `rebound-seo-v1.0.0` at
`fbd738c6508c9cde75231dea60acebe842eb0b6f` using digest
`sha256:321828758e811bbc7bd25aea52a38e253e49b5d7d1402eb27553bc1ed93bb82b`
on machine `860714be531938`, then verify the prior build stamps and stop. Because
`progress-report` has no prior production version and the v1.0.0 UI does not
invoke it, leave the JWT- and RLS-gated function deployed on Fly rollback. Do
not delete it; production function deletion is a separate destructive change
requiring a new recorded Fable 5 High decision.

Stop immediately and report, with no improvisation or retry, if any of the
following occurs: `origin/main` drift before tagging; tag target mismatch; any
required check red, skipped, absent, or attached to another SHA; missing
required secret name; production project mismatch; function deployment
failure or `verify_jwt` not true; any required change to a secret value,
schema, migration, Auth, RLS, Site URL, DNS, certificate, Replit, or existing
tool; Fly health failure; build-stamp mismatch; any touched-route 5xx; or an
unauthenticated `/api/progress/report` request that is not rejected.

### Required completion evidence and exclusions

Completion requires this governance PR URL, merge SHA, and required check-run
URLs; the tag ref and target SHA; name-only secret presence proof; production
function inventory showing `progress-report` active with `verify_jwt=true` on
`etkksjebqgtkkdqznnxa`; workflow-pin PR URL, merge SHA, and required check-run
URLs; Fly deploy run URL and immutable artifact; live build-stamp receipts;
full-route zero-5xx evidence; and the unauthenticated rejection receipt.
Missing evidence means the release is not complete.

Explicitly excluded: every Replit or root-production change; traffic redirect
or cutover; schema or migration; Auth, RLS, or security-model change; Supabase
Site URL change; secret value read or write; real email send; DNS or
certificate change; existing-tool change; any staging-project mutation; and
function deletion on rollback. Anything outside this sequence requires a new
recorded Fable 5 High decision.

## Amendment 1 to D10.2-REBOUND-REDESIGN-V1.1-RELEASE

**Status:** Amendment to existing decision
`D10.2-REBOUND-REDESIGN-V1.1-RELEASE`. This is not a new decision. All terms
of the original decision remain in force except the single verification
predicate replaced below.

### Reason for amendment

The original decision, as repinned by Amendment 2, requires post-merge
`origin/main` to equal the release artifact SHA
`d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`. That check is
unsatisfiable: the governance-only PR appends to
`destiny-product/DEPLOY_LOG.md`, so merging it necessarily advances
`origin/main` past `d75a8b9`. This amendment replaces the impossible
equality check with a non-recursive predicate that preserves the original
intent: the release artifact remains byte-identical to what was verified, and
the only change on `main` is this decision record.

### Replaced verification predicate

The check "post-merge `origin/main` equals
`d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`" is replaced by the following,
all of which must hold:

1. **Ancestry:** post-merge `origin/main` is a descendant of
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`.
2. **Exact changed-path set:** the complete set of paths that differ between
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213` and post-merge `origin/main`
   is exactly `destiny-product/DEPLOY_LOG.md`. No application, configuration,
   migration, or workflow path may differ.
3. **Tag integrity:** the annotated tag `rebound-seo-v1.1.0` must point
   exactly to `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`. The tag may not be
   moved, re-created, or re-pointed by this amendment or the governance
   merge.
4. **Artifact integrity:** the release artifact tree at
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213` remains exactly
   `cef9cda96ecb69869b2778ab931392448267fdf6`; all subsequent release steps
   continue to build and verify against that SHA and tag, not against
   post-merge `origin/main`.

### Amended stop conditions

Stop immediately, before any further step, if the ancestry check fails; the
changed-path set differs in any way from exactly
`destiny-product/DEPLOY_LOG.md`; tag `rebound-seo-v1.1.0` exists at any object
other than `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`; the release artifact
tree is altered; or any stop condition defined in the original decision
occurs.

The strict authorized order and every exclusion in the original decision are
unchanged. All other provisions of
`D10.2-REBOUND-REDESIGN-V1.1-RELEASE` remain in full effect.

## D10.3 — Production redeploy recovery: wrapper materialization + rollback polling; redeploy rebound-seo-v1.1.0 once

Date: 2026-09-01

Authority: Fable 5 High (deciding). Executor: Codex. Owner action: joseangelo510 applies cto-approved to both PRs.

Classification: HIGH — governance (this record) + CI/deployment workflow change + production redeploy.

Policy: HARNESS_POLICY.md @ 04617fbaf010ef4cfc176a7d0ba8b710b7a413bb (protected main).

Evidence accepted: deploy run 33505098654 — build, provenance, rollback-point, certificate, Fly deploy, one-machine health, live v1.1 stamps passed; route sweep failed on URL materialization (curl 3 at /app/content/[draftId]; [draftId] not substituted); no 5xx observed. Rollback run 33505532466 — restore succeeded; verifier asserted while machine was still replacing; live proof confirms v1.0.0 restored (build-sha fbd738c6508c9cde75231dea60acebe842eb0b6f, root 200, POST /api/progress/report → 401, no email).

Release identity (immutable, untouched): tag rebound-seo-v1.1.0, commit d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213, tree cef9cda96ecb69869b2778ab931392448267fdf6.

Scope:

PR-1 (governance): append this block to destiny-product/DEPLOY_LOG.md. No other change.

PR-2 (implementation), only after PR-1 merges: change only

- .github/workflows/rebound-production-deploy.yml
- destiny-product/qa/rules/rebound-production-wrapper.test.ts

Changes limited to: (a) generic materialization of every bracketed path segment to the existing UUID placeholder, failing before any request if a bracket remains, preserving inventory cardinality; (b) rollback verifier polls within the existing five-minute budget until exactly one started machine with the recorded machine ID and prior digest and prior live SHA/tag stamps, then final assertions and evidence upload. Zero-5xx and curl-error-is-failure checks unchanged.

Redeploy: one workflow dispatch from the PR-2 merge SHA on main targeting tag rebound-seo-v1.1.0.

Forbidden: Dockerfile; release tags; product code; route inventory; Supabase; secrets; auth/RLS/session; schema/migrations; DNS/certificates; Replit; existing tools; user data; weakening 87-route or zero-5xx; bypassing protection; tag mutation; unrelated changes.

Gates:

1. PR-1 guards green on exact head SHA; cto-approved by joseangelo510; merged; merge SHA recorded.
2. PR-2 commit A (tests) shown failing in CI; commit B (wrapper) green; git diff --stat shows only the two files.
3. PR-2 harness-gates, staging-evidence, policy-guard, checklist-guard green on exact head SHA; cto-approved by joseangelo510; merged; merge SHA recorded.
4. Single dispatch from the PR-2 merge SHA; main unchanged between merge and dispatch.
5. Success criteria met and evidence uploaded; check-in with run URL.

Success criteria: live build-sha d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213; build-tag rebound-seo-v1.1.0; build-env production; build-site-url https://app.reboundseo.com; exactly one healthy Fly machine; certificate ready; all 87 inventory routes attempted with zero brackets, zero 5xx, zero curl errors; unauthenticated POST /api/progress/report → 401; no email sent; provenance, rollback point, and image digest recorded.

Rollback: on any post-deployment failure, one restore to the recorded v1.0 identity (recorded machine ID and digest; fbd738c6508c9cde75231dea60acebe842eb0b6f; rebound-seo-v1.0.0; https://app.reboundseo.com), verified by bounded polling within the existing budget. No retry loops. Budget exhaustion → stop and report with live proof; no second restore or redeploy without a new decision.

Stop conditions: any path outside the two allowed files; inventory would need to change; TDD order not evidenced; any guard failure on exact head SHA; cto-approved missing or not applied by joseangelo510; main moves before dispatch; any remaining bracket; any 5xx or curl error; machine count ≠ 1; certificate not ready; stamp mismatch; rollback verifier budget exhausted; any second redeploy failure; ambiguity.

Claim boundary: rebound-seo-v1.1.0 live on production with the evidence above and both merge SHAs + guard URLs reported. Not a new release; no tag, product, inventory, or D10-series change.

## D10.4 — Release Rebound SEO v1.1.1 and authorize post-release saved-site read-only QA

Date: 2026-09-01

Authority: Fable 5 High (deciding). Executor: Codex. Owner action:
`joseangelo510` applies `cto-approved` to both protected HIGH PRs.

Decision source:
<https://claude.ai/chat/fe8397c7-3efc-4a74-9c80-3b33bf678a28>

Classification: HIGH. PR #81 remains a merged MEDIUM product repair, but
repinning the production wrapper is a runtime-configuration and production
release change. D10.3 is closed and authorized only the v1.1.0 recovery; it is
not reusable for this release.

Status: APPROVED subject to every condition below. Any deviation voids this
approval. No implementation commit, implementation branch push, release tag,
wrapper edit, or production action is authorized until the governance-only PR
containing this unified D10.4 decision merges with `cto-approved` applied by
`joseangelo510` and every required guard green.

### Decision basis and immutable release identity

Release the already-merged Rebound SEO UX and data-consistency repairs from
protected main artifact:

- annotated immutable tag: `rebound-seo-v1.1.1`;
- commit: `ed8c29aff96f8b4a2644b3806077ceb6863fd72b`;
- tree: `42daea51c48b0eeef97bc34fe91c6660f8a6d5a1`;
- production site: `https://app.reboundseo.com`.

The release tag must be new, annotated, immutable, and never moved or reused.
Before any implementation PR is approved,
`git rev-parse rebound-seo-v1.1.1^{commit}` must resolve exactly to the commit
above and `git rev-parse rebound-seo-v1.1.1^{tree}` must resolve exactly to the
tree above. A pre-existing tag, a different object type, or either mismatch is
a hard stop. Direct deployment of untagged main remains forbidden.

The accepted protected evidence for PR #81 is:

- harness:
  <https://github.com/joseangelo510/destiny/actions/runs/33561233403>;
- staging:
  <https://github.com/joseangelo510/destiny/actions/runs/33561939304>;
- checklist:
  <https://github.com/joseangelo510/destiny/actions/runs/33561939264>;
- policy:
  <https://github.com/joseangelo510/destiny/actions/runs/33561939329>.

### Strict authorized order

1. Open a governance-only protected HIGH PR that appends this D10.4 block to
   `destiny-product/DEPLOY_LOG.md` and changes no other file.
2. `joseangelo510` applies `cto-approved`; all guards pass on the exact PR head;
   then merge the governance PR through branch protection.
3. Create annotated tag `rebound-seo-v1.1.1` at exactly
   `ed8c29aff96f8b4a2644b3806077ceb6863fd72b`, push it once, and verify both
   commit and tree identity.
4. Revalidate the read-only v1.1.0 rollback snapshot recorded below. If live
   identity, machine count/state, machine ID, or digest differs, stop; the
   recorded capture is stale and no implementation PR may open.
5. Open one protected HIGH implementation PR whose complete changed-file list
   is exactly these two files, no more and no fewer:
   - `.github/workflows/rebound-production-deploy.yml`;
   - `destiny-product/qa/rules/rebound-production-wrapper.test.ts`.
6. `joseangelo510` applies `cto-approved`; all protected guards pass on the
   exact implementation head; then merge through branch protection. Do not
   override a red guard or rerun a flake without recording its root cause.
7. Record the implementation merge SHA and prove `origin/main` still equals
   it immediately before dispatch. If main moved after the merge, stop and
   reassess.
8. Dispatch exactly one production `deploy` action for immutable tag
   `rebound-seo-v1.1.1` from that unchanged main.
9. Complete every live receipt below. Only then is D10.4 closed and only then
   may the authorized saved-site QA begin.

The steps are serial. They may not be reordered or parallelized across their
governance boundaries.

### Closed seven-field production-wrapper pin set

The production wrapper identity block has exactly seven authorized changes.
No other field, variable, workflow input, secret reference, Fly setting,
deployment parameter, or runtime value may change. All other values remain
unchanged, byte for byte where practicable.

1. `RELEASE_SHA` changes from
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213` to
   `ed8c29aff96f8b4a2644b3806077ceb6863fd72b`.
2. `RELEASE_TAG` changes from `rebound-seo-v1.1.0` to
   `rebound-seo-v1.1.1`.
3. `PRODUCTION_IMAGE_TAG` changes from `rebound-seo-v1.1.0-prod` to exactly
   `rebound-seo-v1.1.1-prod`. The new registry tag must not exist before the
   release build and must never be overwritten, moved, or reused.
4. `PRIOR_MACHINE_ID` changes from the v1.0.0 rollback value to exactly the
   read-only captured current v1.1.0 machine ID `860714be531938`.
5. `PRIOR_IMAGE_DIGEST` changes from the v1.0.0 rollback value to exactly the
   read-only captured current v1.1.0 child image digest
   `sha256:09600e9480bb2f3c29a1f679bbb0d4bb9115ba341449a348ecfaef701ce7f512`.
6. `PRIOR_RELEASE_SHA` changes to exactly
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`.
7. `PRIOR_RELEASE_TAG` changes to exactly `rebound-seo-v1.1.0`.

Within `.github/workflows/rebound-production-deploy.yml`, only those seven
identity values may change. Within the targeted test, changes may only assert
the seven authorized values and the closed scope. Any third file or any
incidental edit outside this scope invalidates the implementation PR.

### Recorded v1.1.0 rollback snapshot and cross-checks

Read-only capture time: `2026-09-01T22:27:25Z`.

- Fly app: `destiny-production`;
- machine count/state: exactly one machine, `started`;
- machine ID: `860714be531938`;
- live child image digest:
  `sha256:09600e9480bb2f3c29a1f679bbb0d4bb9115ba341449a348ecfaef701ce7f512`;
- live image revision:
  `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`;
- live image version: `rebound-seo-v1.1.0`;
- public build stamps: SHA
  `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`, tag
  `rebound-seo-v1.1.0`, environment `production`, site
  `https://app.reboundseo.com`.

The live machine snapshot was captured with `flyctl machines list --json` and
cross-checked against immutable evidence artifact `9801465031` from successful
production run
<https://github.com/joseangelo510/destiny/actions/runs/33510293696>.
That artifact's `machines-after.json` records the same single started machine,
machine ID, child digest, release SHA, and release tag. Its
`candidate-child-digest.txt` is byte-identical to the digest above. The
separate manifest-list digest
`sha256:b5a8a103e87163955ae4f2dfeaa2d70104db247c744a1921f6de8d4aa9fdd7c6`
is evidence only and is not the value authorized for `PRIOR_IMAGE_DIGEST`.

Cross-checks are mandatory immediately before the implementation PR opens:

1. live production still has exactly one started machine with the recorded ID;
2. its child digest still equals the recorded `PRIOR_IMAGE_DIGEST`;
3. the public stamps still report the recorded v1.1.0 SHA, tag, production
   environment, and site URL;
4. the values committed in the implementation PR are byte-identical to this
   recorded snapshot; and
5. `rebound-seo-v1.1.1-prod` does not already exist in the registry.

Any mismatch makes the capture stale and is a hard stop. No token, credential,
configuration secret, or secret value was read or recorded.

### Deployment success criteria and completion receipts

All of the following are required to close D10.4:

1. governance PR URL, exact head guard URLs, and governance merge SHA;
2. annotated tag object plus resolved commit
   `ed8c29aff96f8b4a2644b3806077ceb6863fd72b` and resolved tree
   `42daea51c48b0eeef97bc34fe91c6660f8a6d5a1`;
3. implementation PR URL, final exact two-file diff, exact head guard URLs, and
   implementation merge SHA;
4. the single production dispatch run URL and successful conclusion;
5. live build stamps showing release SHA
   `ed8c29aff96f8b4a2644b3806077ceb6863fd72b`, release tag
   `rebound-seo-v1.1.1`, environment `production`, and site
   `https://app.reboundseo.com`;
6. full committed route sweep: exactly 87 of 87 materialized routes attempted,
   zero remaining bracket segments, zero curl errors, and zero 5xx responses;
7. exactly one healthy Fly machine, with post-deploy machine ID and image
   digest recorded;
8. production certificate ready;
9. unauthenticated `POST /api/progress/report` returns exactly `401`;
10. explicit confirmation that no email was emitted; and
11. the pre-deploy v1.1.0 rollback snapshot and cross-check evidence above.

Missing evidence means the release is not complete.

### Rollback

On any post-deploy failure, dispatch rollback exactly once to the verified
v1.1.0 identity recorded above: release SHA
`d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`, tag
`rebound-seo-v1.1.0`, machine `860714be531938`, child image digest
`sha256:09600e9480bb2f3c29a1f679bbb0d4bb9115ba341449a348ecfaef701ce7f512`,
and site `https://app.reboundseo.com`.

Poll every 15 seconds for at most 20 polls, five minutes total. Success requires
exactly one healthy machine and public stamps restored to the recorded v1.1.0
SHA and tag. One rollback attempt is the limit. If it fails or the polling
budget expires, freeze all dispatches and stop for a new Jose decision. No
second rollback, second deploy, or improvised recovery is authorized.

### Stop conditions and forbidden scope

Stop immediately, with no partial continuation, if any of the following
occurs: tag commit/tree mismatch; any guard red, skipped, absent, or attached
to another SHA; `cto-approved` missing or applied by anyone other than
`joseangelo510`; any implementation path or edit outside the exact two-file
scope; main movement before dispatch; stale rollback capture; pre-existing
`rebound-seo-v1.1.1-prod`; route count other than 87; any unresolved bracket,
curl error, or 5xx; machine count other than one healthy; certificate not
ready; unauthenticated progress-report POST other than 401; any email; any
digest, build-stamp, scope, identity, or state ambiguity.

Forbidden under D10.4: schema or migration changes; Auth, RLS, or session
changes; dependency changes; secret reads or writes; runtime configuration
beyond the seven fields above; provider credentials; DNS or certificate
changes; CMS or user-data writes; existing-tool behavior changes; report or
email sends; release-tag mutation; protection bypass; and repair of the known
ClearCheck orphaned Calendar/CMS row. That orphan remains a separate
production-data decision.

### Post-release saved-site QA authorization and claim boundary

Only after every deployment receipt is complete, Codex may perform
authenticated, read-only saved-site QA for `joseangelostudios.com` and
`clearcheck.app`, including reading their saved CMS connection state, saved
keywords, and the Home, Content, Calendar, Distribution, and Progress journeys.

Not authorized by D10.4: creating or updating a CMS draft, mutating any keyword,
sending an outbound report or email, or repairing any ClearCheck data. If a QA
step would mutate state, stop that step. Read-only findings may support a new
separately classified repair decision, but do not expand this release.

Claim boundary: D10.4 may be closed only as `rebound-seo-v1.1.1` live on
production with all required receipts and the two named saved sites tested
read-only. It does not prove CMS write delivery, keyword-write behavior,
outbound delivery, or ClearCheck data repair.

## D10.4 Amendment A2 — Authorize Dockerfile release-identity substitutions

Date: 2026-09-01

Authority: Fable 5 High (deciding). Executor: Codex. Owner action:
`joseangelo510` applies `cto-approved` to the governance and implementation
PRs.

Decision source:
<https://claude.ai/chat/fe8397c7-3efc-4a74-9c80-3b33bf678a28>

Classification: HIGH. This amendment resolves a mechanical contradiction in
D10.4 Amendment A1. It does not authorize implementation until this
governance-only amendment merges with every protected guard green and
`cto-approved` applied by `joseangelo510`.

### A2.1 Basis

The D10.4 governance PR merged as
<https://github.com/joseangelo510/destiny/pull/82> at
`7eeb79df71a714a2b4facac633475b960a289213`, with owner approval and all
guards green. Annotated immutable tag `rebound-seo-v1.1.1` is verified as tag
object `c0268864cdf5484a2293d0d667153a194f58c0eb`, commit
`ed8c29aff96f8b4a2644b3806077ceb6863fd72b`, and tree
`42daea51c48b0eeef97bc34fe91c6660f8a6d5a1`.

The read-only rollback snapshot still reports exactly one started Fly machine
`860714be531938`, child image digest
`sha256:09600e9480bb2f3c29a1f679bbb0d4bb9115ba341449a348ecfaef701ce7f512`,
release SHA `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`, and tag
`rebound-seo-v1.1.0`. Both GHCR and the Fly registry returned
`MANIFEST_UNKNOWN` for `rebound-seo-v1.1.1-prod`. No implementation file was
edited or committed before this amendment.

Amendment A1 limited implementation to the workflow and its targeted test.
That scope cannot build the approved release: `Dockerfile` preserves hard-coded
v1.1.0 SHA and tag assertions at build time and container start. Repinning only
the workflow to v1.1.1 would fail those assertions. The ambiguity stop
condition was correctly triggered before implementation.

### A2.2 Closed implementation file list

Amendment A1's two-file implementation list is replaced in full. The complete
implementation PR file list is exactly these three files, no more and no fewer:

1. `.github/workflows/rebound-production-deploy.yml`;
2. `Dockerfile`;
3. `destiny-product/qa/rules/rebound-production-wrapper.test.ts`.

Any fourth file, or any change within these files beyond A2.3 through A2.5,
invalidates the PR and is a hard stop.

### A2.3 Exact Dockerfile authorization

The only authorized `Dockerfile` changes are four literal substitutions:

1. replace both hard-coded occurrences of
   `d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213` in the build-time and
   start-time assertions with
   `ed8c29aff96f8b4a2644b3806077ceb6863fd72b`;
2. replace both hard-coded occurrences of `rebound-seo-v1.1.0` in those same
   assertions with `rebound-seo-v1.1.1`.

Every other `Dockerfile` byte remains unchanged. No base-image change, layer
reordering, instruction addition or removal, whitespace edit, comment edit, or
assertion weakening is authorized. Review must confirm that the Dockerfile diff
is exactly those four token replacements.

### A2.4 Targeted test scope

The targeted wrapper test may assert, and may change only to assert:

1. all seven workflow values authorized by Amendment A1:
   - `RELEASE_SHA=ed8c29aff96f8b4a2644b3806077ceb6863fd72b`;
   - `RELEASE_TAG=rebound-seo-v1.1.1`;
   - `PRODUCTION_IMAGE_TAG=rebound-seo-v1.1.1-prod`;
   - `PRIOR_RELEASE_SHA=d75a8b9dcf7bdecf0272eb2f5d2aebe19ec22213`;
   - `PRIOR_RELEASE_TAG=rebound-seo-v1.1.0`;
   - `PRIOR_MACHINE_ID=860714be531938`;
   - `PRIOR_IMAGE_DIGEST=sha256:09600e9480bb2f3c29a1f679bbb0d4bb9115ba341449a348ecfaef701ce7f512`;
2. both new SHA occurrences and both new tag occurrences in `Dockerfile`, with
   the identity assertions preserved; and
3. the closed three-file implementation scope above.

### A2.5 Required RED then GREEN history

The implementation PR has exactly two commits in this order:

1. **RED:** update only the targeted test to assert the complete A2.4 scope.
   The unchanged workflow and Dockerfile must fail that test, and the failing
   result must remain visible in CI as evidence.
2. **GREEN:** repin the seven workflow values and make the four authorized
   Dockerfile substitutions together, turning the targeted test green.

Do not squash away the RED evidence before review. Any other implementation
commit is out of scope.

### A2.6 Governance precondition

No implementation edit or commit, including the RED commit, may occur before a
governance-only PR containing this amendment is opened, `joseangelo510`
applies `cto-approved`, all exact-head guards are green, and the PR merges to
main. The already-created implementation branch may be retained only while it
has zero commits beyond its post-governance base at A2 merge time; otherwise it
must be discarded and recreated.

### A2.7 Preservation and staleness

All other D10.4 terms remain unchanged: preserve the existing immutable tag and
do not recreate it; preserve the seven workflow pins, rollback identity,
one-attempt bounded rollback, stop conditions, completion receipts, read-only
saved-site QA authorization, ClearCheck orphan exclusion, and every other
forbidden scope.

If live production identity, rollback snapshot values, or either registry's
`MANIFEST_UNKNOWN` status changes between this amendment's merge and
implementation PR approval, the affected capture is stale and execution stops
for reassessment.

Claim boundary: Amendment A2 authorizes only the exact three-file RED/GREEN
implementation above. It authorizes no production dispatch by itself and no
change to product behavior, secrets, providers, data, authentication, schema,
dependencies, routing, certificates, email, or saved-site state.

## D10.5 — Post-release v1.1.1 UX remediation slice

Date: 2026-09-01

Authority: Fable 5 High (deciding). Executor: Codex. Owner action:
`joseangelo510` applies `cto-approved` to the governance and implementation
PRs.

Decision source:
<https://claude.ai/chat/fe8397c7-3efc-4a74-9c80-3b33bf678a28>

### Decision identity and classification

Classification: MEDIUM. The slice changes no schema, migration, Auth, RLS,
session, dependency, secret, provider, DNS, certificate, CMS-write, or runtime
configuration surface, and this decision authorizes no deploy. Shared
site-selection and `effectiveRankSource` touchpoints keep the work at MEDIUM
rather than LOW. If either shared boundary must be edited, that affected work
stops under the split below.

D10.4 and Amendments A1 and A2 are closed complete: PRs #82, #83, and #84
merged; production run 33580758741 is green; and live identity is
`ed8c29aff96f8b4a2644b3806077ceb6863fd72b`, `rebound-seo-v1.1.1`,
`production`. The existing `rebound-seo-v1.1.1` tag remains immutable and
untouched.

### Authorized defect set

Defects 1 through 8 from the authenticated read-only saved-site QA are
authorized in one bounded slice:

1. Add explicit Content row origin/type discrimination. Only `article_draft`
   rows may link to `/app/content/[draftId]`.
   `publishing_schedule_items.needs_review` rows must hand off to an existing,
   valid, site-scoped route. If no existing route can receive the handoff
   truthfully, stop; this decision does not authorize a new route or data write.
2. Include actionable `needs_review` schedule rows in the Content needs-you
   count, or otherwise make the state and call to action truthful. A row and its
   page summary may not contradict each other.
3. Filter core quests to the current completed audit, matching legacy This
   Week/Roadmap semantics. This is read-side filtering only; do not delete or
   mutate historical quests.
4. Anchor the Home calendar to the current month, not `events[0].date`.
5. Render the Home date through an explicit workspace, account, or browser
   timezone contract. Add an `America/Los_Angeles` regression proving that
   September 1 renders as September 1.
6. Correct Distribution presentation so its stuck count truthfully names both
   stale opportunities and unverified interlinks, or decompose the count. Do
   not change its underlying computation beyond labeling or presentation.
7. Add a core-shell site switcher by consuming the existing website-selection
   path. Preserve selection persistence semantics.
8. Make Keyword Strategy consume `effectiveRankSource` against normalized
   approved keywords so its counts agree with Rank Tracker.

The nonreproduced React minified error #418 is a watch item only. No code change
is authorized for it. A QA-log reproduction attempt may be recorded, but repair
requires reproducible evidence and a separate decision.

### Surface boundary

The implementation PR is limited to the following surfaces and their targeted
tests:

- `core-pages.ts` for Content row origin/type discrimination and routing;
- the `loadReboundDraft` and `loadReboundProgress` read paths for query
  discrimination and current-audit filtering;
- `workspace-context.ts` quest loading for read-side filtering only;
- core-shell components for the site switcher and static-label replacement;
- Home calendar and date components for the current-month anchor and timezone
  contract;
- Distribution presentation/copy for the stuck count;
- Keyword Strategy count computation as a consumer of `effectiveRankSource`;
- targeted tests for every item above; and
- generated QA-inventory output only if mechanically required.

The implementation PR description must enumerate its complete final file list.
Every file must map to a surface above. Any file outside that mapping invalidates
the PR. The shared website-selection path and `effectiveRankSource` helper are
not writable surfaces under this decision.

### Required RED then GREEN history and evidence

Before implementation, commit failing tests for each confirmed defect 1 through
8. CI must show those tests fail against unchanged product code. Required
coverage is:

1. `article_draft` versus `publishing_schedule_items` routing discrimination;
2. `needs_review` inclusion in needs-you semantics;
3. quest filtering to the current completed audit;
4. current-month Home anchoring;
5. the `America/Los_Angeles` date regression;
6. truthful stuck-count labeling;
7. site-switcher presence with persistence semantics unchanged; and
8. Keyword Strategy and Rank Tracker count parity on the same fixture.

Each defect test must be isolatable and meaningful on its own. GREEN
implementation commits follow the RED commits. Preserve reviewable RED then
GREEN history through guard review; do not squash away the RED evidence before
review completes. The full protected harness, checklist guard, and policy guard
must be green before merge, with run URLs recorded in this log on completion.

### Process order and completion receipts

1. Merge this decision through a governance-only `DEPLOY_LOG.md` PR with
   `cto-approved` applied by `joseangelo510` and every protected guard green.
2. Open one protected implementation PR for the authorized slice, with
   `cto-approved` applied by `joseangelo510` and every protected guard green,
   then merge.
3. Close D10.5 only after recording the governance PR URL and merge SHA,
   implementation PR URL and complete final file list, RED evidence run, GREEN
   harness/checklist/policy runs, and implementation merge SHA.

No implementation edit or commit, including a RED commit, may occur before
step 1 completes.

### Release and deploy boundary

D10.5 authorizes no tag, production-wrapper change, workflow dispatch, staging
deploy, or production deploy. `rebound-seo-v1.1.1` remains the immutable live
identity. Releasing this slice, presumptively as `rebound-seo-v1.1.2`, requires
a new HIGH decision following the D10.4/A1/A2 governance-first, immutable-tag,
closed-pin, rollback-capture, one-dispatch, and receipt pattern. Any separately
authorized staging or production certification remains read-only.

### Stop conditions

Stop immediately if any of the following occurs:

- any diff line appears in the shared website-selection path or in
  `effectiveRankSource` itself;
- the `needs_review` handoff cannot land on an existing valid route;
- quest filtering cannot be achieved read-side;
- a schema, migration, Auth, RLS, session, dependency, secret, provider,
  CMS-connection, CMS-write, or runtime-configuration change appears necessary;
- any guard is red, skipped, absent, or attached to another SHA, or a RED test
  passes against unchanged code;
- the final implementation file list exceeds the authorized surface mapping;
- any keyword mutation, email/report/social send, tag mutation, deployment, or
  production dispatch occurs;
- any ClearCheck orphan-row touch or JAS credential entry occurs; or
- scope, semantics, or state is ambiguous. Ambiguity requires stop and a
  governance amendment, never inferred authority.

### Shared-reuse authorization and split

Authorized: consume the existing website-selection path and
`effectiveRankSource` exactly as they exist. Reuse is read-only dependency with
byte-unchanged helpers, unchanged signatures, and unchanged behavior for every
existing caller. The harness must prove zero legacy behavioral diffs.

Not authorized, Split B: if remediation requires editing either shared helper's
signature, logic, export shape, or module location, stop the affected defect.
Split B requires its own governance amendment naming the exact helper diff,
complete caller inventory, and regression coverage for every legacy consumer.
Partial delivery is acceptable: if defect 7 or 8 enters Split B, defects that
remain inside this decision may continue and the blocked defect waits for the
amendment.

### Standing exclusions

No schema, migration, Auth, RLS, session, dependency, secret, provider, DNS,
certificate, CMS-connection, CMS-write, keyword mutation, email, report,
social send, tag mutation, production deploy, ClearCheck orphan repair, JAS
credential entry, legacy-tool behavior change beyond consumers-only reuse, or
repair based on the nonreproduced React error is authorized.

### Completion receipts

Status: CLOSED COMPLETE on 2026-09-01. This receipt records implementation and
review evidence only. It authorizes no tag, release wrapper, workflow dispatch,
staging deployment, production deployment, CMS write, keyword mutation, or
outbound send.

- Governance PR: <https://github.com/joseangelo510/destiny/pull/86>
- Governance merge SHA:
  `4e8136eb6cd4571981aa66cf55c35536e32e69dc`
- Implementation PR: <https://github.com/joseangelo510/destiny/pull/87>
- Implementation merge SHA:
  `4f42e08f404b34700ea8b1d0d216b2624654150c`
- Merged tree: `050969d943cba03e8414d8305939347cbd2f0cf8`
- RED evidence run:
  <https://github.com/joseangelo510/destiny/actions/runs/33584861455>
- GREEN full-harness run:
  <https://github.com/joseangelo510/destiny/actions/runs/33584982846>
- Final checklist-guard run:
  <https://github.com/joseangelo510/destiny/actions/runs/33585426841>
- Final policy-guard run:
  <https://github.com/joseangelo510/destiny/actions/runs/33585426829>
- Final staging-candidate run:
  <https://github.com/joseangelo510/destiny/actions/runs/33585426830>
- Exact staging evidence run:
  <https://github.com/joseangelo510/destiny/actions/runs/33584982845>
  (`/` 200, `/api/version` 200, `/keywords` 307 authenticated redirect, zero
  5xx, candidate SHA
  `77b0d500d6e466e63ad5626d5b941e9828846fc7`, candidate tree
  `050969d943cba03e8414d8305939347cbd2f0cf8`)
- Protected merge result: every required guard was green, `cto-approved` was
  applied by `joseangelo510`, and GitHub reported no merge conflicts.

Complete final implementation file list:

1. `destiny-product/qa/inventory/coverage-ledger.csv`
2. `destiny-product/qa/inventory/static-controls.json`
3. `destiny-product/src/app/keywords/page.tsx`
4. `destiny-product/src/components/rebound-core/core-pages-render.test.tsx`
5. `destiny-product/src/components/rebound-core/core-pages.tsx`
6. `destiny-product/src/components/rebound-core/home-dashboard.tsx`
7. `destiny-product/src/components/rebound-core/rebound-core-shell.module.css`
8. `destiny-product/src/components/rebound-core/rebound-core-shell.test.tsx`
9. `destiny-product/src/components/rebound-core/rebound-core-shell.tsx`
10. `destiny-product/src/lib/rebound-core/contracts.ts`
11. `destiny-product/src/lib/rebound-core/core-pages.test.ts`
12. `destiny-product/src/lib/rebound-core/core-pages.ts`
13. `destiny-product/src/lib/rebound-core/home-calendar-summary.test.ts`
14. `destiny-product/src/lib/rebound-core/home-calendar-summary.ts`
15. `destiny-product/src/lib/rebound-core/load-core-pages.ts`
16. `destiny-product/src/lib/rebound-core/load-home.ts`
17. `destiny-product/src/lib/seo/keyword-strategy-summary.test.ts`
18. `destiny-product/src/lib/seo/keyword-strategy-summary.ts`
19. `destiny-product/src/lib/workspace-context.ts`

Claim boundary: D10.5 authorizes only the governed MEDIUM implementation slice
above after its governance PR merges. It authorizes no implementation before
that merge and no deployment under any circumstance.

## DEPLOY_LOG DECISION BLOCK

### D10.6: Production release of D10.5 remediation as rebound-seo-v1.1.2

### 1. Decision identity and classification

Decision ID: **D10.6**
Classification: **HIGH** (production wrapper repin and Dockerfile identity substitution = runtime configuration; production deploy dispatch). Issued under HARNESS_POLICY GOV-1.
Predecessors: D10.4 (with A1, A2) closed. D10.5 closed complete: governance PR #86 (4e8136eb6cd4571981aa66cf55c35536e32e69dc), implementation PR #87 (4f42e08f404b34700ea8b1d0d216b2624654150c, tree 050969d943cba03e8414d8305939347cbd2f0cf8, 19-file list in receipts), receipt PR #88 (1a97c2edae9253ddf18faffd7164582527ed873c), with RED run 33584861455, implementation harness 33584982846, and receipt-head guards 33585810930 / 33586403184 / 33586403241 / 33586403249 all green.

**DECISION: APPROVED, subject to the strict conditions below. Any deviation voids this approval.**

### 2. Release identity resolution (ambiguity closed)

Tag: **rebound-seo-v1.1.2** (annotated, immutable, never moved or reused; remote confirmed absent at decision time)
Commit: **4f42e08f404b34700ea8b1d0d216b2624654150c**
Tree: **050969d943cba03e8414d8305939347cbd2f0cf8**

The tag is placed at the **product implementation merge**, not at current main 1a97c2e. Rationale, recorded to close the ambiguity permanently:

1. Precedent: rebound-seo-v1.1.1 was tagged at the product merge ed8c29a..., not at the then-tip of main after governance commits. Release identity in this repository is the product change set.
2. The only delta between 4f42e08 and 1a97c2e is the D10.5 DEPLOY_LOG completion receipt: governance documentation, not product code. Shipping identity must not absorb documentation about its own preparation.
3. The implementation harness 33584982846 certified exactly tree 050969d9... The tag then points at the precise tested product tree with zero interpretation required.
4. 4f42e08 is an ancestor of protected main, so the tag remains fully on the protected history.

Verification, mandatory before any implementation edit: `git rev-parse rebound-seo-v1.1.2^{commit}` must return 4f42e08f404b34700ea8b1d0d216b2624654150c and `git rev-parse rebound-seo-v1.1.2^{tree}` must return 050969d943cba03e8414d8305939347cbd2f0cf8. Any mismatch is a stop condition. Deployment of untagged main remains forbidden.

### 3. Closed wrapper pin set for v1.1.2

The seven-field set is closed and exhaustive. Exactly these values, byte for byte:

1. RELEASE_SHA: ed8c29a... → **4f42e08f404b34700ea8b1d0d216b2624654150c**
2. RELEASE_TAG: rebound-seo-v1.1.1 → **rebound-seo-v1.1.2**
3. PRODUCTION_IMAGE_TAG: rebound-seo-v1.1.1-prod → **rebound-seo-v1.1.2-prod** (new, never-pushed; pre-existence in GHCR or Fly registry is a stop condition, never an overwrite)
4. PRIOR_RELEASE_SHA: d75a8b9... → **ed8c29aff96f8b4a2644b3806077ceb6863fd72b**
5. PRIOR_RELEASE_TAG: rebound-seo-v1.1.0 → **rebound-seo-v1.1.1**
6. PRIOR_MACHINE_ID: **860714be531938** (unchanged value, revalidated capture; no hand-typed carryover, the committed value must be byte-identical to the fresh capture)
7. PRIOR_IMAGE_DIGEST: sha256:09600e94... → **sha256:618150a9b7b6fe863c41b74967cb2ae1d4a9ae02136fb3662ad054ca9d616cc3** (the current live v1.1.1 child digest; the outgoing v1.1.0 digest is retired from the wrapper)

Rollback target is thereby the verified live v1.1.1 identity. Mandatory read-only revalidation of the rollback baseline occurs twice: immediately before opening the implementation PR (the values are committed into it) and immediately before deploy dispatch. Each revalidation must show exactly one healthy machine 860714be531938 in started state, child digest sha256:618150a9...cc3, and live stamps SHA ed8c29a..., tag rebound-seo-v1.1.1, env production, site https://app.reboundseo.com. Any drift voids the capture and stops execution for reassessment. All captures record identifiers only, never secrets.

### 4. Implementation file list

Exactly three files, no more and no fewer:

1. `.github/workflows/rebound-production-deploy.yml` (the seven pins in section 3 and nothing else)
2. `Dockerfile` (exactly four literal substitutions: both hard-coded SHA occurrences ed8c29aff96f8b4a2644b3806077ceb6863fd72b → 4f42e08f404b34700ea8b1d0d216b2624654150c in the build-time and start-time assertions; both hard-coded tag occurrences rebound-seo-v1.1.1 → rebound-seo-v1.1.2. All other bytes unchanged. The identity assertions are guards and must be preserved, never weakened or removed.)
3. `destiny-product/qa/rules/rebound-production-wrapper.test.ts` (asserts the seven pins, the four Dockerfile identity literals at their asserted positions, and the closed three-file scope)

No other file is mechanically required, and none is authorized. If implementation discovers a genuinely mechanically necessary fourth file, that discovery is a stop condition requiring a governance amendment naming the exact file and justification before any further edit. A fourth file may not be added by convenience.

### 5. Strict serial sequence (no reordering, no parallelization)

1. Governance-only DEPLOY_LOG PR containing this D10.6 block. No code, wrapper, or tag activity in or before it.
2. joseangelo510 applies cto-approved; all exact-head guards green; protected merge.
3. Annotated tag rebound-seo-v1.1.2 created at 4f42e08... and verified per section 2 (commit and tree both match).
4. Registry absence check: rebound-seo-v1.1.2-prod returns MANIFEST_UNKNOWN in both GHCR and Fly registry. Rollback baseline revalidation number one per section 3.
5. **RED commit alone:** the targeted test updated to the full section 4 item 3 scope, committed by itself, visibly failing in CI against the unchanged workflow and Dockerfile.
6. **GREEN commit:** workflow repin plus the four Dockerfile substitutions, turning the test green. PR history preserves RED then GREEN through guard review.
7. Full protected guards and staging green on the implementation PR; joseangelo510 applies cto-approved; protected merge.
8. No-movement check: at dispatch time, protected main must resolve exactly to the implementation PR merge SHA. If main moved, stop.
9. Rollback baseline revalidation number two per section 3. Then exactly **one** production deploy dispatch.
10. Live verification and receipts per sections 6 and 9. Only then does D10.6 close.

No implementation edit or commit, including the RED commit, may occur before step 2 completes. Any implementation artifact created earlier is invalid and discarded, not retrofitted.

### 6. Deployment invariants (all required)

1. Dynamic full committed inventory sweep at its current committed size (presently 87): 100% materialized, zero unresolved brackets, zero curl errors, zero 5xx.
2. Exactly one healthy Fly machine post-deploy; certificate ready.
3. Live startup stamps: SHA 4f42e08f404b34700ea8b1d0d216b2624654150c, tag rebound-seo-v1.1.2, env production, site https://app.reboundseo.com.
4. Unauthenticated POST /api/progress/report returns 401.
5. No email, report, or social send emitted by build, deploy, or verification.
6. Provenance chain recorded: tag object SHA, image digest pushed as rebound-seo-v1.1.2-prod, machine ID, and both rollback revalidation captures.

### 7. Rollback path

Target: the verified v1.1.1 identity exactly as pinned in section 3 (tag rebound-seo-v1.1.1, SHA ed8c29a..., machine baseline 860714be531938, child digest sha256:618150a9...cc3). One rollback dispatch pinned to that identity. Bounded polling: health check every 15 seconds, maximum 20 polls, 5 minutes total. Success requires live stamps ed8c29a... / rebound-seo-v1.1.1 and one healthy machine. **One attempt only.** On failure or poll exhaustion: freeze all dispatches, stop entirely, escalate to Jose for manual decision. No automated second attempt, no improvisation.

### 8. Stop conditions and forbidden scope

Stop immediately on any of: tag/commit or tag/tree mismatch; PRODUCTION_IMAGE_TAG pre-existence; any guard red; RED tests passing against unchanged code; any file beyond the three named; any edit beyond the seven pins and four substitutions; rollback baseline drift at either revalidation; main movement before dispatch; route sweep below 100%, any bracket, curl error, or 5xx; machine count ≠ 1; certificate not ready; wrong live stamps; progress-report POST ≠ 401; any email; any digest/log/PR byte disagreement; any ambiguity, which resolves to stop and amendment, never to proceed.

Forbidden under D10.6: schema, migration, Auth/RLS/session, dependency, secret, provider credential, DNS/certificate changes; CMS or user-data writes; keyword mutation; email/report/social sends; any release-tag mutation other than creating the new immutable rebound-seo-v1.1.2; ClearCheck orphan repair (still a separate production-data decision); JAS credential entry.

### 9. Completion receipts (all required to close D10.6)

1. Governance PR URL and merge SHA.
2. Tag verification output (tag object, commit 4f42e08..., tree 050969d9...).
3. Registry MANIFEST_UNKNOWN evidence and both rollback revalidation captures.
4. Implementation PR URL, final three-file diff list, RED evidence run URL, GREEN guard/staging run URLs, merge SHA.
5. Deploy dispatch run URL and conclusion.
6. Live stamp output, full route sweep results, machine ID and post-deploy digest, certificate check, 401 evidence, no-email confirmation.

### 10. Post-release authenticated recertification

**Authorized after all section 9 receipts:** read-only authenticated recertification of saved sites joseangelostudios.com (d8885d33-2047-45fa-a0c7-4ccd44fa4932) and clearcheck.app (99a7af37-6588-4b97-a848-8877760182a9) across Home, Content, Calendar, Distribution, Progress, saved CMS connection state, and saved keyword/count consistency, including verification that the eight D10.5 defect fixes behave as specified. **Still excluded:** CMS writes, keyword mutation, outbound sends of any kind, ClearCheck orphan repair, JAS credential entry. Read-only means read-only; a step that would mutate state is out of scope and stops there.

### 11. Claim boundary

This release claims exactly: the D10.5 eight-defect remediation scope applied on top of the v1.1.1 production behavior, with unchanged schema, auth, dependencies, configuration beyond the seven pins, and legacy-tool behavior. No other behavioral claim is made or implied. The nonreproduced React #418 log remains a watch item, unclaimed and unrepaired.

---

D10.6 issued. Nothing has been executed under this release. Execution authority begins at section 5 step 1 and terminates automatically on any section 8 stop condition.
