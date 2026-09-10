# Warm-up coach Home

Status: implemented locally, not merged or live. Verified source base: 8e65ba71e95c93284bf2bc595e1d8a3ac4cc3414. Date: 2026-09-09 America/Los_Angeles.

Owner: Codex task 01a08897-59bf-75c3-94a9-87dc9187fd6f, the sole active Rebound implementation. Jose requested: “lets build this design instead for rebound coach variation.” The selected reference is variant 1, Warm-up, in https://claude.ai/chat/34d18455-2644-4259-a66e-33eae73d3467. Its visible code and preview were inspected. Download failed; no local original is claimed.

MEDIUM UI change. /app/home now shows the existing site's ranked first task in the reference's warm paper, forest green, serif hero, completion guidance, quiet current-status strip, three on-deck items, and expandable full-system navigation. Open full workspace reveals the existing dashboard, performance sources, keyword and competitor panels, calendar, ranked session, sidebar and tools. Back to your coach restores the focused view. Existing onboarding, site-scoped data loader, task rankings, persistence, and all backend workflows are unchanged.

The source loader builds tasks from saved website quests; metrics come from existing Search Console summaries. No visit timestamp is collected here, so the strip says current status rather than since your last visit. Estimates are null today; swapping is called See another move, without a five-minute claim. The pottery examples, 41 impressions, ranking/volume claims, weekly streak, Thursday check-in, automatic schedule and social-share promises are not used. Approval, scheduling, publication and verification remain separate. This implementation does not introduce a new agent, publish content or send messages.

Tests: new rendering coverage demonstrates the first move, site links, missing/error/empty data and measured zero. Browser coverage checks swaps without writes, workspace toggling, existing tools, responsive overflow, accessibility and a second site. Existing Home panel tests now exercise HomeWorkspace explicitly, and existing browser tests open that workspace first. This is the reason for the test-change commit, not a reduced contract.

Rollback: revert this product change through a protected PR; there is no schema migration or data conversion.


Release preparation 2026-09-09: D10.23 records Jose's explicit deployment and dependency approval. The overall release change is HIGH. Next.js/eslint-config-next 16.3.3, sharp 0.35.4 and transitive xmldom 0.8.15 clear the blocking audit. A minimal pnpm patch preserves concatenated client module ID 0 in the Next.js manifest; the existing WorkspaceNotifications component is concretely assigned ID 0 and missing without it, reproducing upstream https://github.com/vercel/next.js/issues/97937 on clean local/CI builds. Existing authenticated journeys provide RED/GREEN coverage; the patch changes only two null guards and must be copied into both dependency-install stages in the separate release wrapper. No customer notification behavior or security boundary changes. Replace the patch only when an upstream release includes and verifies the fix.
