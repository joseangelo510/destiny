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

## D-MVP-M3-P1-REDEPLOY-2 — 2026-08-26

Authority: Fable 5 High (CTO decision) after the first M3 publish lacked verifiable
build provenance and the public version endpoint remained on the old behavior.
Decision: CONDITIONAL GO — exactly one owner-account Replit UI redeploy of the
existing deployment `a5e94a27-6ca6-4f32-a8a7-08e671bf965d` from the already
verified detached workspace commit `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa`,
tree `235f628315cbfb58f55766456985828557d798e6`.
First-attempt receipt: the connector reported the same deployment pending, building,
then running; Replit reported an active successful VM build but exposed no independent
build ID, timestamp, source SHA, or logs. Public `/` returned 200 while exact GET
`/api/version` returned 401. P1 therefore remained NO GO. No rollback was performed
because the live root stayed healthy and no 5xx was observed.
Required preconditions: detached commit and tree still match and the worktree is clean;
the workspace contains the public version route and build-stamp code; deployment config
rebuilds the served artifact from this workspace; the public domain maps only to the
existing deployment; a cache-busted, no-cache version request still returns 401.
Mechanism: Replit Deployments UI only, using the existing deployment's Redeploy or
Republish action. Capture deployment history before and after plus the post-initiation
successful build log and timestamp.
Proof required: post-initiation UI build receipt; root 200; `/api/version` 200 with the
authorized commit/tree build stamp; and zero 5xx on touched routes.
Prohibited: a second connector publish, Replit Agent mutation, new deployment, code or
configuration edits, environment/secret/domain/dependency changes, or any third publish.
Stop: if any precondition fails, do not redeploy. After redeploy, `/api/version` still
401 or stamp mismatch means halt with P1 NO GO and no third attempt. Roll back through
deployment history only if root becomes non-200 or core routes return 5xx.
Merge hold: PRs #17 and #18 remain unmerged until P1 is green.
Status: AUTHORIZED — awaiting recorded protected merge, preconditions, one UI redeploy,
and P1 evidence.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1.

### D-MVP-M3-P1-REDEPLOY-2-A1 — Fable 5 High amendment

Trigger: read-only preflight found Replit-created detached commit
`3fca8286853c12715530f9e9fb91abd5a5a9b4c4`, parent `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa`,
with the same tree `235f628315cbfb58f55766456985828557d798e6` and an empty
diff. Replit metadata also could not independently expose the deployment ID or routing
history. Codex correctly halted before a second redeploy.
Decision: CONDITIONAL GO — amend the verification anchor from exact commit identity to
exact tree identity. Do not realign the workspace. A clean commit is authorized only if
its tree equals `235f628315cbfb58f55766456985828557d798e6` and its diff
against `61745a2c4b5a461b27d5574d6cd472ff9bc67dfa` is empty. A
post-publish build stamp may name a further Replit-created empty child, but its tree must
match and the workspace diff must remain empty.
Domain proof substitute: before publish, capture the Replit Deployments pane showing
exactly one deployment for this app, its visible ID matching `a5e94a27`, status, and
timestamp, plus the domain view showing `destiny-seo.replit.app` attached to that
deployment with no additional domains. Multiple deployments or any unexpected domain is
a stop. After publish, a cache-busted GET `/api/version` must return 200 with
`Cache-Control: no-store` and JSON tree `235f628315cbfb58f55766456985828557d798e6`;
the stamped commit must have an empty diff against `61745a2`. The current pre-publish
401 is the expected before state, not a pre-publish stop.
Sequence: record this amendment; capture clean-tree, empty-diff, deployment, and domain
evidence; Jose re-applies `cto-approved` at the amended head; required checks become
green; Jose performs exactly one owner-account UI redeploy; verify version attestation,
root 200, and zero 5xx; append evidence on this PR; re-apply approval at the final head;
then merge through protected main with a completion receipt.
Executor boundary: Codex must not click publish or retry. Jose performs the single UI
redeploy. Any dirty tree, tree mismatch, multiple deployment/unexpected domain, post-
publish 401/non-200, wrong tree, any 5xx, red/skipped/wrong-SHA check, or absent current-
head approval means halt and return to Fable High. No rollback is authorized without a
new High decision.
Hold: PRs #17 and #18 remain unmerged.
Status: AUTHORIZED — amendment recorded; awaiting pre-publish proof, current-head owner
approval and green checks, Jose's single UI redeploy, post-publish evidence, final-head
approval, and protected merge.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1.

## DEC-2026-08-26-DESTINY-SOCIAL-01 — guided social sharing launch scope

Authority: Fable 5 High (CTO decision) requested by Jose after the M3 production
republish sequence was already governed separately.
Classification: split. Read-only verification of the existing guided-sharing flow is
MEDIUM; automatic provider publishing is HIGH because it introduces OAuth, provider
credentials, runtime configuration, storage/schema ambiguity, and representational
communication.
Decision: GO for guided sharing only. NO GO for automatic provider publishing in this
launch. Destiny may expose `draft`, `ready to share`, `opened in composer`, and
`shared (manual, unverified)` states with evidence appropriate to each state. Destiny
must not claim `published` until it can retain an authoritative provider post ID and a
resolvable public post URL. `scheduled` may describe only Destiny's internal calendar
intent, not provider-side scheduling.
Verification contract: after the truthful social UI reaches production, verify LinkedIn,
X, and Facebook composer URLs, exact encoded copy and canonical URL, shared URL HTTP
200, correct preview metadata, truthful calendar language, and absence of false
published/success claims. Any real post remains a Jose-performed provider-UI action
after action-time confirmation of the exact copy, destination account, and link.
Automatic publishing: deferred. A future implementation requires a new HIGH decision
after Jose chooses whether automatic publishing is desired and identifies the intended
LinkedIn identity, X account, and Facebook Page.
Correction: the original advisory response included an inconsistent release-order
clause saying PR #17 should merge before the final M3 republish. That clause is void and
is superseded by `DEC-2026-08-26-DESTINY-RECONCILE-01` below. This decision does not
change, consume, or add a Replit republish attempt.
Status: AUTHORIZED for guided-sharing verification only after its separately governed
protected merge and production deployment. Automatic publishing remains NO GO.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1.

## DEC-2026-08-26-DESTINY-RECONCILE-01 — M3 republish and PR #17 order

Authority: Fable 5 High (CTO reconciliation decision) after Codex identified a direct
ordering conflict between `D-MVP-M3-P1-REDEPLOY-2-A1` and the advisory sequence in
`DEC-2026-08-26-DESTINY-SOCIAL-01`.
Decision: Sequence A controls. `D-MVP-M3-P1-REDEPLOY-2-A1` remains controlling and
unmodified. Jose first performs the one second-and-final owner-account Replit UI
Republish of the authorized M3 tree
`235f628315cbfb58f55766456985828557d798e6`, after every A1 precondition is
reconfirmed. Codex and automation must not click or retry. PRs #17 and #18 remain held
until P1 is green.
Reason: merging PR #17 first would change the authorized tree and spend the final
attempt on an unverified tree, contradicting the narrow earlier decision. The social
decision's guided-sharing-only scope survives; only its release-order clause is void.
Sequence: (1) record the social decision, correction, and this reconciliation; (2)
capture clean-tree, empty-diff, one-deployment, one-domain, and pre-publish 401 evidence;
(3) verify current-head owner `cto-approved` and all required checks green; (4) Jose
clicks Republish exactly once; (5) Codex verifies deployment identity, cache-busted
`/api/version` 200 with `no-store` and the authorized tree, root 200, zero 5xx, and
appends evidence. PR #20 may then complete through protected main. PRs #17 and #18 may
then resume through their own protected gates, with any production deployment governed
by a new HIGH decision.
Stop conditions: dirty tree, tree mismatch, non-empty diff, extra deployment or domain,
missing current-head owner approval, red/skipped/wrong-SHA checks, post-publish 401,
wrong tree, or any 5xx. No third attempt exists.
Status: AUTHORIZED — conditional GO for Jose's final UI Republish only after actions
1–3 are proven at the current head.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1.

## DEC-2026-08-26-DESTINY-PR20-RECOVERY-01 — replacement PR recovery

Authority: Fable 5 High (CTO recovery decision) after Codex recorded the two preceding
decisions with an invalid `docs:` commit subject on PR #20.
Decision: GO for an additive replacement PR. Commit
`4fe8b5f43597b3545fcf4f9d861f2439daef3593` permanently fails the repository's
commit-subject policy; force push, history rewrite, admin bypass, and non-linear history
remain prohibited. Create the replacement branch from PR #20's previous green head
`55e91b835e429229809dcd13740923503a405c6b`, and carry the two decision records plus
this recovery reason in one `green:` commit. The replacement must have all required
checks green and Jose's current-head `cto-approved` label before PR #20 is closed
unmerged as superseded.
Effect: content remains identical except for this recovery receipt. The authorized M3
tree, A1 sequence, actor boundary, and single remaining Replit Republish attempt are
unchanged. No one touches Republish until the replacement PR satisfies every A1 gate.
Status: AUTHORIZED — replacement protected PR recovery only.
Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1.
