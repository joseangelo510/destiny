# Destiny communications beta contract

Status: v1 frozen for implementation  
Scope: closed beta only  
Owner: Jose  
Implementation branch: `codex/comms-beta`

## 1. Qualifying action

- Plain language: a signed-in user completes one actionable Destiny quest for a website.
- Canonical event: `quest.action_completed`.
- Existing source: `PATCH /api/quests/[id]` in `src/app/api/quests/[id]/route.ts` changes a quest from a non-complete status to `complete`.
- Existing eligibility rule: `isStreakActionableTask()` in `src/lib/quests/completion.ts`. `business_confirmation` and `vocabulary_review` do not qualify; all guided SEO work does.
- Non-actions: opening Destiny, viewing a board, filtering, changing a task's guided state, completing a confirmation-only task, or reopening a task.
- Undo: reopening does not claw back a previously recorded qualifying action. The event is historical and idempotent by quest plus completion timestamp.
- Backfill: no late backfill into a closed local week during beta. An action counts in the local week in which the completion event occurred.
- Multi-user rule: continuity is per signed-in user and website for beta. One teammate cannot silently preserve another teammate's Week.

## 2. Week state machine

States:

- `open`: current local Week has no qualifying action and is before Friday noon.
- `completed`: at least one qualifying action occurred in the Week.
- `at_risk`: no qualifying action by Friday 12:00 local time.
- `frozen`: the Week closed incomplete and one automatic freeze was consumed.
- `recovering`: no freeze was available and the user is inside the 48-hour recovery window.
- `recovered`: two qualifying actions were completed during recovery.
- `broken`: recovery expired without two actions.

Rules:

1. A Week starts Monday 00:00 and ends the following Monday 00:00 in the user's IANA time zone.
2. `open` plus a qualifying action becomes `completed` and emits `week.completed`.
3. `open` at Friday 12:00 local becomes `at_risk` and emits `week.at_risk`.
4. `at_risk` plus a qualifying action becomes `completed`.
5. An incomplete Week at its local end consumes one available freeze, becomes `frozen`, and emits `week.frozen`.
6. If no freeze is available, the Week becomes `recovering`, opens a 48-hour window, and emits `week.recovery_offered`.
7. Two qualifying actions inside the recovery window become `recovered` and emit `week.recovered`.
8. An expired recovery window becomes `broken` and emits `week.broken`.
9. Each user and website receives two freezes per calendar quarter. They are automatic and cannot be purchased.
10. Local-week and reminder calculations must pass DST boundary tests.

Persisted fields:

```text
website_id, organization_id, user_id
local_week_start, week_number, user_timezone
window_start_at, window_end_at
state, streak_length, qualifying_action_count
recovery_action_count, recovery_expires_at
freezes_remaining, freezes_reset_at
created_at, updated_at
```

## 3. ScorecardSnapshot

```text
ScorecardSnapshot {
  accountId, websiteId, messageId
  weekNumber, streakLength, weekState, freezesRemaining
  headline
  metrics[0..4] { key, label, value, delta, direction, sparkline[0..4] }
  wins[0..3] { objectName, objectUrl, from, to, metric }
  attention[0..1] { problem, cause, fix, timeCostMinutes, deepLink }
  cta { label, deepLink, timeCostMinutes }
  nextWeek { weekNumber, actionsRequired, timeCostMinutes }
  variant: full | thin | first
}
```

- `first`: first scorecard for a website.
- `thin`: insufficient connected or historical evidence for a meaningful comparison.
- `full`: current evidence plus at least one prior comparison or verified win.
- Every URL is an exact website-scoped deep link. Templates contain no hardcoded metric values.

## 4. NotificationEvent

```text
NotificationEvent {
  eventId, accountId, websiteId, userId
  occurredAtUtc, userTimezone
  type
  job: continuity | reflection | direction | celebration | alarm | discovery
  priority: 0 | 1 | 2
  groupingKey, dedupeKey, bypassBatch
  render { title, objectName, objectUrl, delta, timeCostMinutes }
  payload
}
```

Routing for beta:

| Event | Job | Priority | Batch behavior |
| --- | --- | ---: | --- |
| `quest.action_completed` | celebration | 0 | batch |
| `week.completed` | continuity | 0 | batch |
| `week.at_risk` | continuity | 1 | Friday message |
| `week.last_chance` | continuity | 1 | Sunday message |
| `week.frozen` | continuity | 1 | batch |
| `week.recovery_offered` | continuity | 1 | batch |
| `week.recovered` | celebration | 0 | batch |
| `scorecard.ready` | reflection | 1 | Monday email |
| `onboarding.step_ready` | direction | 0 | behavior-triggered email |
| `alarm.indexation_collapse` | alarm | 2 | bypass |
| `alarm.crawl_blocked` | alarm | 2 | bypass |
| `alarm.money_keyword_drop` | alarm | 2 | bypass |

Ten events sharing a grouping key inside one batch window render as one grouped row. Critical alarms bypass batching and do not wait for a digest.

## 5. Preferences and caps

- Cadence values: `essential`, `weekly`, `guided`, `muted`.
- Default: `weekly`.
- Default channel cap: no more than two non-transactional emails and one non-transactional push per user and website per local Week.
- Alarm and transactional messages are exempt from the cap.
- Every non-transactional message links to the cadence screen.

## 6. Instrumentation

Every rendered message receives a stable `message_id`. Record these outcomes with the message, event, website, user, and timestamp:

- `downstream_completion`
- `dismiss`
- `mute`
- `opt_out`
- `freeze_used`
- `recovery_used`

## 7. Beta surfaces

Email variants:

1. Weekly Scorecard — full
2. Weekly Scorecard — thin
3. Weekly Scorecard — first
4. Friday Week at risk
5. Sunday last chance
6. Onboarding email 2 — first data landed

In-app surfaces:

1. Persistent Week indicator — safe, at risk, frozen
2. Day-zero achievement
3. Cadence preference screen
4. Batched notification row

Out of scope: XP, levels, unlock ladders, leaderboards, social comparison, purchasable freezes, monthly scorecards, anniversary artifacts, and share graphics.

## 8. Freeze gate

Template code can ship only when:

- the data contract compiles as shared TypeScript types;
- local-week and DST tests pass;
- all three scorecard variants render from payloads rather than embedded values;
- grouped events and critical bypass tests pass;
- preferences and all six outcomes are persisted with user and website isolation;
- the Friday and Sunday messages cannot exceed two continuity messages in a Week.
