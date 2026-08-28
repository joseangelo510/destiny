# Post-deploy receipt

Decision: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A1`

Receipt status: **DEPLOYED, SMOKE INCOMPLETE**

This receipt distinguishes the deployed Edge Function from the older Replit application surface. It does not claim a Replit release, a complete five-kind smoke, or a complete production release.

## Protected approval and merge

- Record PR: <https://github.com/joseangelo510/destiny/pull/32>
- `cto-approved` actor: `joseangelo510`
- Merge method: normal protected squash merge; no admin bypass
- Merge commit: `d723ae7d7b5f983aafeaa23398b8e672691ace02`
- Checklist guard: <https://github.com/joseangelo510/destiny/actions/runs/33130070835>
- Policy guard: <https://github.com/joseangelo510/destiny/actions/runs/33130070876>
- Harness gates: <https://github.com/joseangelo510/destiny/actions/runs/33129352289>
- Staging evidence: <https://github.com/joseangelo510/destiny/actions/runs/33129693992>

## Controlled deployment

- Deployment time: `2026-08-28T00:36:14.208Z`
- Project: `etkksjebqgtkkdqznnxa`
- Function: `seo-research`
- Function ID: `6b6d5160-7376-4e8b-8081-900d637a1aec`
- Authorized source commit: `450ae943fde32ad479692a851e09bc6d58a27944`
- Authorized repository tree: `2ec2f8919700c7ff7a1fae13d55f99970f45cf1d`
- Authorized function tree: `903ecae5e0d868f1390fe2128733f71113f13101`
- Previous version: `12`, package SHA-256 `e9e8bea879002b80be9c30e26e9b92754a8f2e61cb784ead2ce7d44840aa4f37`
- Active version: `13`, package SHA-256 `bc24f3de73aa3c3e6c5a6c6f5c7721266e53eabde9320c1924b826facd51b586`
- JWT verification: retained as `true`
- Changed production surface: the existing `seo-research` Edge Function only

No Replit publish, plan-tier change, database write, migration, auth change, RLS change, secret/config change, CMS publish, email, or social post was performed.

## Immediate production evidence

All completed calls used the Jose Angelo Studios workspace and rendered through the authenticated production application.

| Path | Time (UTC) | Status | Edge latency | Evidence |
|---|---:|---:|---:|---|
| `keywords`, domain mode | 2026-08-28 00:40:09 | 200 | 1,372 ms | 100 live rows, 90-day performance, sortable metrics, ranking URLs, strategy/tracker actions |
| `keywords`, keyword mode | 2026-08-28 00:40:41 | 200 | 4,730 ms | Live commercial-intent rows rendered without parser or UI failure |
| `backlinks` | 2026-08-28 00:42:17 | 200 | 992 ms | Live overview, 1.3K backlinks, 506 referring domains, quality/attribute summaries, and rows rendered |
| `keyword_serp` | outstanding | not invoked | — | Current Replit app lacks the merged route; same-origin app POST returned pre-existing 404. No direct credential was available without a secret/session-store action. |
| `creators` | outstanding | not invoked | — | Jose Angelo Studios is on the beginner tier; the app returned 403 before Edge invocation. No plan change is authorized. |
| `article_evidence` | outstanding | not invoked | — | No standalone live application route exists. The available app route also invokes Anthropic article generation, which is outside this decision. |

No version-13 5xx, timeout, parse failure, or invocation above ten seconds was observed in the completed smoke calls.

## Live-application correction

The Replit production frontend is older than the merged repository surface. The prior G1b inference that the nearest publish commit represented the live frontend was incorrect. Existing keyword and backlink responses remain backward compatible and render successfully, but the live frontend does not expose the merged first-page route or the new questions, related searches, organic competitors, and page-type UI.

The same-origin `/api/research/keyword-serp` `404` is a pre-existing application-surface gap. It is not an Edge Function regression and rolling back version 13 would not create the route.

## Provider guardrail

- Pre-deploy DataForSEO balance: `$42.129398`
- Post-smoke balance: `$41.914722`
- Observed balance change: `$0.214676`
- Escalation ceiling: `$5`
- Rollback ceiling: `$10`
- Result: below both ceilings

The balance change includes the exercised keyword and backlink provider calls; it is not attributed solely to the additive live-SERP request.

## Binding CTO hold decision

Fable 5 High issued **Decision C** in the governing thread: keep version 13 active, do not roll back, and do not republish Replit under A1. The app-route 404 does not count as the A1 Edge Function rollback trigger because the route was absent before this deployment and is outside the changed surface.

Authorized next actions are limited to:

1. Continue the 60-minute, 6-hour, 24-hour, and 72-hour observation checkpoints against the existing ceilings.
2. Directly invoke the three outstanding Edge paths only if an already-held, non-exposed credential is available.
3. If no such credential is available, leave the smokes outstanding and retain the status **DEPLOYED, SMOKE INCOMPLETE**.

Explicitly not authorized: Replit republish, plan-tier change, Anthropic article generation, secret/config change, database write, or any workaround that inspects or exposes session credentials.

Decision source: <https://claude.ai/chat/bbdba982-9e3a-4b70-957c-6e61752fc275>

## Observation checkpoints

| Checkpoint | Status | Evidence |
|---|---|---|
| Immediate | PASS WITH OUTSTANDING SMOKES | Three version-13 calls returned 200; no ceiling triggered |
| 60 minutes | pending | Supabase Edge Function logs and DataForSEO balance |
| 6 hours | pending | Supabase Edge Function logs and DataForSEO balance |
| 24 hours | pending | Supabase Edge Function logs, 5xx share, latency, invocation upper bound, balance |
| 72 hours | pending | Final observation and release-close decision |

