# Fable 5 High decision: D-MVP-RECOVERY-1C

Date: 2026-08-24

Classification: HIGH

Decision: GO for the exact seven-path recovery scope below. No expansion is authorized.

## Production classification

The Replit deployment is **LIVE, UNPROVEN, M2 BY RECEIPT**. Replit reports the deployment as successful and created publish receipt commit `961bca1eec332a43a617aadb2e9b4246f73c8218`, whose parent is approved M2 `d0c302cf1d0e52207b9154b37ec8728ea6d792fc` and whose tree is the byte-identical M2 tree `28daab7097aa56dcbe50e42389a8142b8b1937cd`. Runtime identity is not proven because no post-trigger build record was captured and unauthenticated `GET /api/version` returns `401`.

P1 remains NO GO. Publishing, scheduling, and social actions remain halted.

## Authorized paths

1. `destiny-product/package.json`
2. `destiny-product/scripts/write-build-stamp.mjs`
3. `destiny-product/src/lib/supabase/proxy.ts`
4. `destiny-product/qa/rules/build-provenance-policy.test.ts`
5. `destiny-product/src/lib/supabase/proxy.test.ts`
6. `destiny-product/docs/releases/D-MVP-RECOVERY-1/FABLE_HIGH_DECISION.md`
7. `destiny-product/DEPLOY_LOG.md`

## Required behavior

- `build` invokes `node scripts/write-build-stamp.mjs && next build --webpack`; `prebuild` is absent.
- The stamp writer always exits successfully and emits exactly one `build-stamp:` receipt line with `sha`, `tree`, `builtAt`, `source`, and `cwd`.
- Stamp identity falls back from Git, to a valid existing stamp file, to `unknown`.
- Only unauthenticated `GET /api/version` is public. `POST /api/version` and every other protected API remain blocked.
- RED evidence precedes GREEN implementation.
- The full governed gate and protected PR workflow are mandatory.

## Replit receipt and environment note

The platform receipt is preserved by local-only tag `receipt/replit-publish-961bca1`; it must never be pushed. Replit added `qgit` to ignored, untracked `replit.nix` during a shell pager recovery. The file does not affect the approved Git tree, was not reverted, and is not authorized for modification.

## Next Replit action

None is authorized by this decision. Detaching Replit to the future M3 commit requires a separate Fable 5 High GO after this PR is merged and its exact merge-SHA harness is green.
