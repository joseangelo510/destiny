# Preflight evidence

Evidence date: `2026-08-27`

Status: complete for the docs-only decision record. Production deployment has not occurred.

## G1 — source and blast radius

- Protected-main commit: `450ae943fde32ad479692a851e09bc6d58a27944`
- Repository tree: `2ec2f8919700c7ff7a1fae13d55f99970f45cf1d`
- `seo-research` function tree: `903ecae5e0d868f1390fe2128733f71113f13101`
- Production-code change already merged on main: bounded `seo-research` keyword SERP evidence plus its existing product consumer.
- The Edge Function still reads only `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`; no secret value was read, printed, or stored.
- No schema, migration, view, RPC, auth, RLS, provider credential, or runtime dependency change is part of this decision-record PR.
- `providerPost` retains its `45,000ms` timeout.
- The optional seed SERP request is bounded to depth `10` and ends in `.catch(() => null)`.
- The standalone `keyword_serp` request is bounded to depth `10`.

## G1b — accepted live-provenance substitute

- Production deployment start: `2026-08-27T01:47:36.818Z`
- Nearest publish commit: `3fca8286853c12715530f9e9fb91abd5a5a9b4c4`
- Nearest publish tree: `235f628315cbfb58f55766456985828557d798e6`
- Route blob: `d00139b8bfebbcdbfc5934f424c12f50e58d24db`
- Workspace and publish-commit route blobs: identical
- API compatibility: `destiny-product/src/app/api/research/keywords/route.ts` returns successful Edge Function JSON directly with `NextResponse.json(data)`.
- Client compatibility: `questions`, `related`, `serpCheckedAt`, and `serpEvidenceStatus` are optional fields in `destiny-product/src/lib/seo/research.ts`.
- Known gap: production `/api/version` returned `401`; Fable accepted behavioral live-UI proof after deploy as the closing receipt.

## G1c — existing-kind preservation

- The source diff changes the `keywords` branch only for keyword-mode seed SERP enrichment.
- `backlinks`, `creators`, `article_evidence`, and domain-mode keyword behavior are not rewritten.
- Unsupported-kind copy is expanded to name `keyword SERP`.
- Post-deploy smoke must cover all five kinds; this is not inferred from static inspection.

## G2 — type and logic proof

Transient official Deno:

- release: `2.9.6 stable`
- target: `aarch64-apple-darwin`
- install directory: `/tmp/destiny-deno-preflight.ZkMfIL/deno`
- cache directory: `/tmp/destiny-deno-cache.UVqFZu`
- official archive checksum: passed before execution
- command: `deno check --config deno.json index.ts`
- working directory: `destiny-product/supabase/functions/seo-research`
- result: pass

Canonical focused logic suite:

- package manager: `pnpm 11.19.0`
- install: `pnpm install --frozen-lockfile`
- Vitest: `4.1.10`, `darwin-arm64`, Node `v24.19.0`
- command: `pnpm exec vitest run supabase/functions/seo-research/logic.test.ts`
- working directory: `destiny-product`
- result: `1` test file passed; `11` tests passed; duration `531ms`
- `pnpm-lock.yaml` SHA-256 before and after: `214566cbc896dc0a245cd3daa994b8b2f63d3e3a7258b1b96479ff17897725c4`
- repository dependency/config change: none
- Deno lockfile: none retained

Known coverage gap accepted by Fable: the helper parser and page-type logic are covered, while the handler's four new optional fields do not have a direct handler-level test. The immediate production smoke is the required handler proof.

## G3 — active production rollback source

- Supabase organization: `Jose Angelo Studios Pro`
- Project: `joseangelo85@gmail.com's Project`
- Project ref: `etkksjebqgtkkdqznnxa`
- Function: `seo-research`
- Function ID: `6b6d5160-7376-4e8b-8081-900d637a1aec`
- Active production version: `12`
- JWT verification: `true`
- Production package SHA-256: `e9e8bea879002b80be9c30e26e9b92754a8f2e61cb784ead2ce7d44840aa4f37`
- Rollback source retrieved: `2026-08-27T23:55:27.392Z`
- Credential values in artifact: none
- Manifest: `rollback-v12/SHA256SUMS`

The production package SHA and source-file manifest are intentionally separate identities.

## G4 — functional-execution boundary

Fable waived a local production-equivalent server. Deno check provides runtime/type proof and Vitest provides pure-logic proof. Static source shows the optional seed request fails soft through `.catch(() => null)`. The immediate authenticated production smoke after the future single-function deploy is the first handler execution and is mandatory before the release can proceed.

## G5 — rollback verification

Before a future deploy, verify `rollback-v12/SHA256SUMS` and re-confirm active production version `12`, package SHA, and JWT setting. If a stop condition fires, deploy the captured rollback source as a new version, confirm it becomes active with JWT verification retained, and smoke the four old kinds. Do not compare the server package SHA to the source manifest.

## G6 — current traffic and cost ceiling

Read-only Supabase Log Explorer query for the last 24 hours returned two `seo-research` invocations:

| UTC timestamp | Status | Duration | Version |
| --- | ---: | ---: | ---: |
| `2026-08-27T22:23:49.364000` | `200` | `996ms` | `12` |
| `2026-08-27T20:13:40.640000` | `200` | `1054ms` | `12` |

- 24-hour invocation upper bound `N`: `2`
- maximum observed duration: `1054ms`
- observed 5xx count: `0`
- DataForSEO account identity: `Jose Gallegos`
- DataForSEO balance: `$42.129398`
- DataForSEO expenses for `2026-08-21` through `2026-08-27`: `$1.3700`
- DataForSEO Google organic live SERP published unit price, 10 results: `$0.002` per SERP
- published live turnaround: up to `6s` average
- maximum incremental daily spend at observed traffic: `2 × $0.002 = $0.004`
- pricing verified: `2026-08-27`
- pricing source: <https://dataforseo.com/pricing/serp/google-organic-serp-api>

The cost estimate is deliberately an upper bound: domain-mode calls do not add the seed live-SERP request.

## Deployment documentation reference

Supabase documents single-function deployment and post-deployment testing at <https://supabase.com/docs/guides/functions/deploy>. The future deployment must target only `seo-research`, preserve JWT verification, and attach a deployment receipt; this packet does not perform it.

## Local repository harness

The full local `pnpm gate` was attempted from `destiny-product` after the decision-record commit.

- repository policy: pass
- commit policy: pass
- deploy-log policy: pass
- QA inventory: pass (`79` routes, `762` interactive or mutation surfaces; no generated diff)
- migration audit: pass (`52` source migrations preserved, `17` remote aliases recorded, `3` unapplied forward migrations present)
- dependency audit: pass under the repository policy (`2` known high-severity findings, both ignored by the existing audit policy)
- ESLint: pass
- Vitest full suite: `177/177` files and `1,159/1,159` tests pass
- local isolation, production build, and Playwright: not run because the desktop environment has neither Docker nor Podman; Supabase local start stopped with `LegacyDockerLifecycleInspectError`

This is an environment limitation, not a claimed full local gate pass. The protected GitHub `harness-gates` run for the exact PR SHA remains authoritative and must be green before the draft may leave draft status or merge.

## Record-PR verification checklist

- [x] Fable High conditional decision and amendment recorded.
- [x] Static source and consumer compatibility recorded.
- [x] Production provenance substitute recorded.
- [x] Deno check passed with a transient official binary.
- [x] Focused Vitest suite passed after frozen install.
- [x] Repository lockfile unchanged and no Deno lockfile retained.
- [x] Rollback source and deterministic manifest captured without credentials.
- [x] Active production version, JWT setting, and package SHA recorded.
- [x] 24-hour invocation and latency sample recorded.
- [x] Provider balance, seven-day spend, published price, and incremental upper bound recorded.
- [ ] Full repository harness green for the decision-record PR SHA; local pre-container stages passed and GitHub must complete the container-dependent stages.
- [ ] Required GitHub checks green for the decision-record PR SHA.
- [ ] `cto-approved` applied by `joseangelo510`.
- [ ] Protected merge completed.
- [ ] Post-merge exact-SHA pre-deploy gates completed.
- [ ] Production deploy and observation receipts completed.
