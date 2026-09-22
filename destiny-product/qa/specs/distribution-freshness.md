# Distribution freshness continuity

Classification: MEDIUM. Base958af2c8fa585c31565474c4bf2556922a43d7da. Authorized by the ongoing Rebound acceptance and routine-repair request, task01a0c2b9-ffe5-70a1-b974-2daef7dba3fd. Sole active implementation owner: this task. No auth, schema, billing, provider or deployment changes.

Live receipt295: overview marks eight stale conversations; Reverify navigation opens the same records labeled Verified unconditionally. Expected: consistent dated evidence, no verification by navigation, and an explicit action to start the existing audited refresh flow for the selected website. Reuse existing freshness and URL validation and existing audit starter; refresh remains subject to normal entitlements and may fail on the separately documented production AUDIT-01 defect. Never advance freshness optimistically.

Acceptance: old/missing/invalid dates stay stale in both views; recent saved observations show their date without implying a check at page load. A newly completed audit can supply fresh results. Selected-site audit request uses existing API and error/redirect behavior. Invalid destinations do not become links. Saved valid thread URLs remain inspectable, clearly labeled as saved. No external posting or automatic audit on page load.

Tests: failing page rendering cases then shared-model repair; focused tests, full gate, desktop/mobile recovery controls before release. Protect existing source/state and preserve other Distribution tools. Rollback via protected revert. Creator and directory classification defects remain separately tracked.
