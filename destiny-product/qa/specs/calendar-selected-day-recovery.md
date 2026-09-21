# Calendar selected-day recovery

Risk: MEDIUM. Decision D10.49; baseline c3a51270ca85cebd711a5c5d4539063131abb0df.

## User promise

Clicking Add content on an available calendar day selects exactly that day in Schedule approved draft. A subsequent day selection preserves the chosen draft and website. The existing scheduling action saves that local day at 09:00 in the publishing plan timezone.

Past or occupied days do not offer a scheduling link. If refreshed data makes the chosen day unavailable, the form requires an explicit new choice instead of silently scheduling another day. Switching websites resets the planner state.

## Implementation boundary

CalendarPlanner owns date state shared by MonthCalendar and CalendarActions. Existing scheduling API, timezone conversion, scoped persistence, draft eligibility and site context are preserved. No production, billing, auth, configuration, dependency or schema changes. Published-draft eligibility is a separate known issue.

## Evidence

- RED: four desktop/mobile browser failures against the running PR141 production candidate, whose calendar runtime is unchanged from this baseline. Choosing September 30 retained September 21; past-day links also failed availability assertions.
- GREEN: unchanged date-handoff assertions pass on the repaired production build. Four browser cases exercise repeated selection, draft retention, exact request timestamp/site, actual disposable API save, GET persistence after reload, and unavailable-link exclusion.
- Test-only adjustment excludes the new empty placeholder when enumerating available choices. No failed behavioral assertion removed. The two previously diagnosed dated distribution fixtures are frozen without assertion changes.
- Existing calendar/render/timezone focused suite: 27 tests passed. Full harness, exact-head staging and review are required before merge.

Rollback: protected revert. Disposable tests create planned items only; no client content or CMS publication occurs.
