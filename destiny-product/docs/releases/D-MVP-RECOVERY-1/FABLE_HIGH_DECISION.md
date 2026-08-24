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

## Amendment D-MVP-RECOVERY-1E (2026-08-24)

Trigger: PR #14 at immutable approved head 04b8815a1d3e92c58b27d20bb5dbfff67d6aa223 reported mergeable_state dirty after PR #15 [D-MVP-RECOVERY-1D] merged to protected main at b6caa0055cd62c79bbf56049e5434206b00b48b7. Read only merge-tree showed exactly one conflict, destiny-product/DEPLOY_LOG.md, append only: PR #14 appends D-MVP-RECOVERY-1C, main appends D-MVP-RECOVERY-1D at the same end of file position. Precondition verified: git diff d0c302c b6caa00 over the six implementation paths is empty.

Decision: Option B. PR #14 is retained unchanged as the frozen record, closed unmerged as superseded once the new PR is open, and cto-approved is removed from it at that moment. A new branch gov/recovery-1c-r2 is created from b6caa00 and PR #14's four commits are cherry-picked in original order: f14bde1 (green: records), 0d2db17 (red:), 702bf93 (test-change:), 04b8815 (green: implementation). Commits two through four are unchanged byte for byte. Commit one resolves the DEPLOY_LOG conflict by keeping main's content in full, appending the D-MVP-RECOVERY-1C entry exactly as approved, then appending the D-MVP-RECOVERY-1E entry, and adds this amendment block. Order in the log is merge order, not decision order. Exactly five code and test implementation paths remain byte identical to PR #14; the two record paths are reviewed as authorized diffs. No fifth commit.

Rejected: a conflict resolution merge commit on gov/recovery-1c, because its first parent diff would carry PR #15's test and non test changes together, which the canonical commit policy cannot classify, and because it would mutate a head declared immutable by D-MVP-RECOVERY-1D.

Evidence: focused RED at commit three head and GREEN at commit four head recreated on the new branch; PR #14 runs cited as history only. Full gate once at final head. Blob equality for the six implementation paths between 04b8815 and the new head. Same four required checks as PR #15 plus the CI ephemeral staging evidence D-MVP-RECOVERY-1D requires, transferred unchanged.

Sequencing: push and PR open only after the merge SHA harness on b6caa00 is green. cto-approved applied to the new PR only on a renewed APPROVE EXACT DIFF bound to its head SHA; void if the head moves.

Stop conditions: any conflict outside DEPLOY_LOG; any cherry-picked diff differing from its source; blob inequality on the six paths; deploy log policy rejection of the appended ordering; PR #14 head moving; any check red on the new head; harness on b6caa00 red.

Prohibited: editing or force pushing gov/recovery-1c, rebasing or merging PR #14, admin bypass, and any Replit, production, auth or RLS, migration, secrets, tag, publish, schedule, social, email, customer data, or deployment action.

Mutations: none.

Decided by: Destiny CTO under HARNESS_POLICY.md GOV-1
