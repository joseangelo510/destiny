# Destiny LOGOS migration safety plan

## North star

LOGOS becomes Destiny's primary product-logic language. TypeScript remains the
runtime and integration layer for UI rendering, network access, authentication,
authorization, persistence, secrets, background execution, and generative AI.

## Accepted compressed migration plan

Destiny has no public users yet, and the owner has explicitly accepted the
risk of an aggressive LOGOS-primary cutover before launch. The migration uses
local/CI parity instead of production shadow infrastructure.

- Keep a linear migration history. Do not squash or rebase phase checkpoints.
- Default each completed domain to LOGOS only after its parity and end-to-end
  gates pass.
- Keep one rollback variable: `DESTINY_ENGINE=typescript`. Any other value, or
  an unset value, selects LOGOS.
- Keep the legacy TypeScript implementation as a temporary rollback path until
  two quiet weeks after public launch. Git remains the durable recovery path.
- Tag every completed domain before beginning the next one.
- Freeze unrelated feature development until the LOGOS-primary cutover tag.

The heavier trace tables, production shadow execution, retention jobs,
monitoring cron, database-configured flags, and 30-day promotion gate described
in the original architecture review are deferred until real usage warrants
them.

## Minimum gate for every domain

1. Fixture parity covers representative real-business inputs.
2. Empty, zero, maximum, and malformed-input behavior is covered.
3. The complete related user flow passes with LOGOS selected.
4. Full tests, lint, and production build pass.
5. The rollback variable is tested before the phase is tagged.

The migration is honestly LOGOS-primary when LOGOS is the default authority
for scoring, recommendations, coaching progression, roadmap progression, and
plan rules. TypeScript may fetch, normalize, persist, and render data, but it
must not make those product decisions.

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

## Rollback

1. **Fast rollback:** set `DESTINY_ENGINE=typescript` and restart/redeploy the
   affected runtime.
2. **Code rollback:** deploy the previous annotated phase or application tag.
3. **Data recovery:** use Supabase recovery only for actual data corruption.
   LOGOS phases remain schema-additive, so ordinary rollback does not require a
   database restore.

## Deferred production safeguards

- Database changes remain additive. Do not drop or rename fields used by the
  fallback before the post-launch stability window ends.
- Browser and worker artifacts come from one compile-and-embed command.
- Time, timezone, randomness, and other nondeterministic inputs are explicit.
- Prefer integer scoring in LOGOS to avoid JavaScript/WASM floating-point drift.

## Migration order

1. Keyword eligibility and rejection reasons.
2. Keyword intent and revenue priority.
3. Editorial calendar and three-month strategy.
4. Weekly coaching, scheduling, and task selection.
5. Roadmap and verified milestone progression.
6. LLM visibility progression and source task policy.
7. Plan-tier limits, rank-tracker refresh rules, and remaining audit policy.
