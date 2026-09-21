# Onboarding audit-start recovery

Risk: MEDIUM. Base: c3a51270ca85cebd711a5c5d4539063131abb0df.

When the onboarding profile save succeeds but starting its audit fails, show the failure and its recovery action. Do not leave the user looking at a running research screen with an estimated completion time after the request has already failed.

## Reproduction and change

Acceptance testing at the base SHA completed all three onboarding steps in disposable local Supabase. The profile request returned200; the audit request returned502. The processing screen remained running at0/6with no retry. The parent passed a new failed status, but the processing component had already initialized its internal state from the earlier running status.

The parent now keys the processing instance by its audit status. Moving from running to failed initializes the existing recovery screen from the failed request's status and error. The parent retains all onboarding answers. Audit polling on an existing audit page remains unchanged.

## Acceptance criteria

- Hold the initial audit request until the real form displays research running.
- A502response then displays the returned safe error and Review and try again; the running label and timer disappear.
- Retry restores the competitor step with the exact entered competitor and differentiation values.
- A402response displays View plans and billing instead of a blind retry.
- Existing successful submission still redirects to its returned audit ID.
- No new provider request or credit is consumed just to render or retry-review the saved form.
- No authentication, schema, quota, tenant scope, or publication behavior changes.

## Validation record

- Local CUA before/after: failure was stuck at the base; changed UI displays Research paused and preserves values on retry. Evidence117–118in the task's user-acceptance-2026-09-20 output folder.
- Five focused rendering tests pass. These alone do not cover the dynamic transition.
- New browser regressions explicitly cover running-to502and running-to402transitions. Their automated execution remains required in the full harness.
- Baseline distribution tests used September1checkedAt fixtures against real current time. Both failures reproduced at the unchanged base. The separate test-change commit freezes only the test clock atSeptember2; freshness and stale-evidence assertions remain intact.
- Full unit suite after deterministic clock repair:1504/1504passed. Lint:zero errors,eight existing warnings. Full current-head CI, staging and review remain required; no release is claimed here.

Rollback: protected revert of the UI change. No database rollback or customer data deletion is needed.
