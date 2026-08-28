# Fable 5 High decision

## Identity

- Parent decision: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY`
- Amendment: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A1`
- Date: `2026-08-27`
- Authority: Fable 5 High, acting as Destiny CTO under `HARNESS_POLICY.md` policy `GOV-1`
- Decision source: <https://claude.ai/chat/bbdba982-9e3a-4b70-957c-6e61752fc275>
- Classification: `HIGH`
- Decision: `CONDITIONAL GO` on Route B
- Current status: `AUTHORIZED PENDING`

## Authorized action

After this decision record merges through a protected HIGH pull request, Codex may prepare and execute one deterministic redeploy of the existing Supabase Edge Function `seo-research` from the exact protected-main source commit `450ae943fde32ad479692a851e09bc6d58a27944`. The target is Supabase project `etkksjebqgtkkdqznnxa`, function ID `6b6d5160-7376-4e8b-8081-900d637a1aec`, with JWT verification retained as `true`.

The existing `keywords` response addition is accepted. The decision does not authorize any database migration, schema change, auth or RLS change, credential mutation, release tag, Replit modification, traffic redirect, email, social post, customer CMS publish, or other production change.

## Accepted implementation finding

The following seven-point source finding is the bounded implementation scope accepted by Fable:

1. `parseKeywordSerp` is added to the Edge Function's logic imports.
2. The existing `keywords` branch adds `seedSerpPayload` to its parallel provider requests.
3. Keyword mode adds one bounded DataForSEO advanced organic SERP request with depth `10`, and provider failure is caught to `null`.
4. The keyword-mode response adds only `questions`, `related`, `serpCheckedAt`, and `serpEvidenceStatus`; a failed seed request returns truthful empty or unavailable evidence rather than failing the original keyword response.
5. A new `keyword_serp` kind uses the same parser and a depth-`10` advanced organic SERP request.
6. `logic.ts` adds conservative page-type classification and bounded parsing for organic results, People Also Ask questions, and related searches; its focused Vitest file covers those helpers.
7. Existing backlink, creator, article-evidence, and domain-keyword branches remain unchanged apart from the unsupported-kind error copy.

## Evidence substitutions accepted by Fable

### Production provenance

The production Edge Function does not expose the repository SHA. Fable accepts this deterministic substitute before the record PR:

- production deployment start: `2026-08-27T01:47:36.818Z`;
- nearest publish commit: `3fca8286853c12715530f9e9fb91abd5a5a9b4c4`;
- nearest publish tree: `235f628315cbfb58f55766456985828557d798e6`;
- route blob: `d00139b8bfebbcdbfc5934f424c12f50e58d24db`;
- workspace and publish-commit route blobs are identical;
- `destiny-product/src/app/api/research/keywords/route.ts` passes successful JSON through unchanged;
- `destiny-product/src/lib/seo/research.ts` treats the new fields as optional and does not reject unknown keys;
- known gap: production `/api/version` returned `401` during evidence gathering.

After deployment, the substitute must be closed with behavioral proof in the Jose-owned live UI: existing keyword results still render and the new questions and related-search evidence renders without parser or display errors.

### Runtime and tests

Fable accepts transient official Deno as the runtime/type-check tool. It must not add a repository dependency, committed config, or lockfile. Required proof is:

- `deno check --config deno.json index.ts`;
- the canonical focused Vitest suite for `logic.test.ts` after a frozen-lockfile install;
- no lockfile change;
- the seed-request failure path is accepted from the exact source line ending in `.catch(() => null)`.

A local production-equivalent server is waived. The immediate production smoke is the first functional handler execution.

### Rollback identity

The production package SHA and deterministic source manifest are recorded separately. They are not expected to equal one another. Rollback proof is:

1. verify the rollback source against `rollback-v12/SHA256SUMS`;
2. deploy that captured source as a new rollback version while retaining JWT verification;
3. confirm the new rollback version is active;
4. smoke the four pre-existing kinds.

### Provider cost

Let `N` be the observed 24-hour upper-bound count of `seo-research` invocations. The maximum incremental DataForSEO live-SERP spend is `N × $0.002`. The record includes the current provider balance, available seven-day spend, invocation count, and latency sample.

## Required sequencing

### Before the record PR leaves draft

1. Record the static source diff and compatibility evidence.
2. Record the accepted production-provenance substitute.
3. Pass Deno check and the focused canonical Vitest suite with no committed dependency or lockfile change.
4. Store the rollback source manifest and production package SHA separately.
5. Record the 24-hour invocation count and latency sample.
6. Record the DataForSEO balance, published unit price, available seven-day spend, and incremental cost upper bound.
7. Keep the PR docs-only and run the repository harness required by `GOV-1`.

### After Jose merges the decision record and before deployment

1. Use a fresh checkout of the exact source commit and verify its full SHA and tree.
2. Confirm production version `12` is still active and the package SHA still matches the recorded package SHA.
3. Reverify the rollback manifest.
4. Recheck the DataForSEO balance.
5. Confirm JWT verification remains `true`.
6. Deploy only `seo-research`.
7. Immediately smoke all five kinds on a Jose-owned domain: `keywords`, `keyword_serp`, `backlinks`, `creators`, and `article_evidence`.
8. Verify the Jose-owned live UI renders the old keyword result and the new SERP evidence correctly.
9. Begin a continuous 60-minute watch, then recheck at 6, 24, and 72 hours.

## Absolute stop and rollback conditions

- Escalate without rollback when implied added live-SERP spend exceeds `$5` in a rolling 24 hours (`2,500` invocations), or provider balance falls more than `$5` beyond the pre-deploy rate.
- Roll back when implied added live-SERP spend exceeds `$10` in a rolling 24 hours (`5,000` invocations), or provider balance falls more than `$10`.
- Roll back any timeout whose trace includes the seed SERP request.
- Roll back a 30-minute window containing at least 10 calls when p95 latency exceeds `10s`.
- Escalate any single invocation over `30s`.
- Roll back if any immediate smoke is non-200.
- Roll back if `keyword_serp` omits FAQs/questions, related searches, organic competitors, or page types when the provider returns those features.
- Roll back a 30-minute window containing at least 10 calls when 5xx share exceeds `5%`.
- Roll back on live UI render failure or parser/render errors attributable to the redeploy.

## Governance controls

The record PR requires `cto-approved` applied by `joseangelo510`, all required checks, and protected merge. The deployment is not complete without a deploy receipt, post-deploy smoke evidence, watch evidence, the merge SHA, and exact check-run URLs. Rollback is itself a HIGH production action and must follow this decision's measured stop conditions and receipt process.
