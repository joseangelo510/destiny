# Destiny LOGOS migration safety plan

## North star

LOGOS becomes Destiny's primary product-logic language. TypeScript remains the
runtime and integration layer for UI rendering, network access, authentication,
authorization, persistence, secrets, background execution, and generative AI.

## Verified baseline

- Production reference: `https://destiny-seo.replit.app/`
- Baseline date: 2026-08-03
- Live production WASM SHA-256:
  `60b30315b7999a3256d4896c6cbcfbab817dfdc9df0672b096f5cfc9f2c46b19`
- Reconstructed source WASM SHA-256:
  `60b30315b7999a3256d4896c6cbcfbab817dfdc9df0672b096f5cfc9f2c46b19`
- LOGOS compiler: LOGICAFFEINE/Largo 0.10.1
- Baseline verification: 239 tests passed; lint passed; production build passed.
- Pre-Git local Phase 1 archive:
  `outputs/backups/destiny-logos-phase1-local-wip-2026-08-03.tar.gz`
- Archive SHA-256:
  `9156771c5b542d85d7064607f24585ae99f6a09677d4043734d8a365bf16d0df`

The archive intentionally excludes environment files, dependencies, build
caches, release ZIP files, and generated target directories.

## Git structure

- `main`: production truth. Only tested, deployable releases merge here.
- `migration/phase-1-keyword-policy`: first LOGOS authority domain.
- `migration/phase-N-<domain>`: one branch per later product-logic domain.
- `hotfix/<issue>`: production repairs branched from the latest deployed tag.
- `baseline-pre-logos-2026-08-03`: immutable annotated baseline tag.
- `engine-vX.Y.Z`: annotated tag for every promoted LOGOS engine.
- `vX.Y.Z`: annotated tag for every production application release.

## Four rollback levels

1. **Authority flag:** switch the affected domain from `logos` to `typescript`
   without a deployment. Keep the TypeScript path running during the stability
   window so this fallback remains real.
2. **Artifact pin:** select the last compatible versioned WASM artifact and
   verify its checksum and engine-version handshake.
3. **Code rollback:** redeploy the latest known-good application tag from
   `main`.
4. **Data recovery:** use Supabase point-in-time recovery or a verified export
   only for data corruption. Normal rollback must not require restoring data.

## Migration rules

- Database changes remain additive until at least 30 days after a LOGOS domain
  becomes authoritative. Do not drop or rename fields used by the fallback.
- Browser and worker artifacts come from one compile-and-embed command.
- Each artifact records source hash, compiler version, build flags, and output
  checksum. Browser and worker adapters must verify the same engine version.
- Shadow evaluations record rules version, normalized inputs, both outputs,
  decision differences, latency, and fallback reason under protected RLS.
- Trace retention and sampling are explicit because traces can contain customer
  business context.
- Time, timezone, randomness, and other nondeterministic inputs are explicit.
- Prefer integer scoring in LOGOS to avoid JavaScript/WASM floating-point drift.

## Gate for each business-logic domain

### Gate A: enter shadow mode

- Baseline and production tags exist remotely.
- Supabase schema and data export is verified.
- Typed input/output contract tests pass.
- Browser/worker engine-version handshake passes.
- Trace storage, RLS, retention, and sampling pass.
- TypeScript remains authoritative.

### Gate B: enter canary

- Eligibility decisions match exactly.
- Rule identifiers match exactly.
- Ranking and prioritization meet a written top-N/order tolerance.
- Every difference is classified as a LOGOS bug, TypeScript bug, or resolved
  specification ambiguity.
- No unexplained difference remains in the canary corpus.

### Gate C: become authoritative

- Low-risk canary has no material error-rate or latency regression.
- The authority flag and last-good artifact rollback have both been exercised.
- Real-domain regression cases pass.
- LOGOS becomes authoritative only for the promoted domain.

### Gate D: remove the fallback

- LOGOS has remained authoritative and monitored for at least 30 days.
- Rollback metrics and trace review show stable behavior.
- TypeScript policy removal ships as its own tagged, reversible release.

## Migration order

1. Keyword eligibility and rejection reasons.
2. Keyword intent and revenue priority.
3. Editorial calendar and three-month strategy.
4. Weekly coaching, scheduling, and task selection.
5. Roadmap and verified milestone progression.
6. LLM visibility progression and source task policy.
7. Plan-tier limits, rank-tracker refresh rules, and remaining audit policy.
