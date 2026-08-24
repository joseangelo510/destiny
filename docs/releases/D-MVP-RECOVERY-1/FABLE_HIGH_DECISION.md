# D-MVP-RECOVERY-1 — Production provenance recovery

- Date: 2026-08-24
- Authority: Fable 5 High, Destiny CTO under `HARNESS_POLICY.md` GOV-1
- Decision record: https://claude.ai/chat/1adeff18-8f8a-4346-9e1c-5a6287d93e1b
- Decision: P1 HARD NO GO; certification remains OPEN and production is UNVERIFIED

## Triggering evidence

- Canonical main: `8e2100323196c9cf0145ef78824294213df169ba`, tree `e3baafcd2300c5bde18ccabbf5c6ab3a23b642a7`
- Live Replit deployment: `a5e94a27-6ca6-4f32-a8a7-08e671bf965d` at https://destiny-seo.replit.app
- Replit workspace: `codex/interviews-feature` at `db1a17adccad9f2a29d3241146fc4f65651a0dcf`, tree `c492deeec56cbe82aca6b9bbcda573dbb8dcfeb7`
- The workspace and canonical main diverge at merge base `28d184fd0e46826df264f545f7f7a2d79544a204`; the workspace is ahead by one and behind by 63.
- The live app exposes no runtime SHA, so no evidence ties the deployment to the approved build.
- No live certification mutation occurred before the stop.

## Binding recovery sequence

1. Treat Replit as a consumer of protected canonical main; author no product changes in Replit.
2. Preserve the existing clean workspace commit and tree. Confirm `codex/interviews-feature` is backed up remotely; preserve it under tag `rollback/pre-recovery-1` before alignment.
3. Add a build-generated version stamp and public `GET /api/version` endpoint that returns `sha`, `tree`, `builtAt`, and `env`. If Git is unavailable, return `unknown` and fail closed.
4. Add a preflight script that compares the live SHA with canonical main and exits nonzero on mismatch or `unknown`.
5. Implement with RED then GREEN tests, complete `pnpm gate`, a protected PR titled with `[D-MVP-RECOVERY-1]`, required labels, required checks, and a green post-merge harness.
6. Only after merge, detach the Replit workspace at the new merge SHA, verify its tree, republish the existing deployment in place, and require the live version endpoint and preflight to match the merge SHA.
7. Resume D-MVP-CERTIFICATION-2 only when the merge SHA/tree, post-merge harness, live version response, preflight exit zero, rollback tag, and this decision record are all proven.

## MVP decisions

- LinkedIn and X remain manual, site-bound handoffs for the MVP. No OAuth, token storage, provider SDK, or automated social-send work is authorized by this decision.
- WordPress future scheduling may satisfy the scheduled-publish P0 only when the scheduling handoff receipt is persisted and Destiny reconciles against WordPress after the scheduled time. Destiny may never infer `published` solely from its own timestamp. Lazy reconciliation on read plus an explicit manual Reconcile action is acceptable; no new background job is authorized.

## Prohibitions and rollback

No direct main commit, branch-protection bypass, out-of-branch Replit edit, secret or environment change, new deployment, production content mutation, social send, or schedule action is authorized until P1 passes. Any unexpected Replit workspace change halts recovery. Rollback uses `rollback/pre-recovery-1` and redeploys the existing deployment in place.

