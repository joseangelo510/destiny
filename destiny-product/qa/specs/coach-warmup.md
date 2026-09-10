# Coach Warm-up acceptance

MEDIUM; base 8e65ba71e95c93284bf2bc595e1d8a3ac4cc3414; owner task 01a08897-59bf-75c3-94a9-87dc9187fd6f. Implemented, not live. 2026-09-09.

- RED: coach-home.test.tsx failed four assertions on the unchanged Home (2026-09-09 16:56 PDT).
- GREEN: same four assertions passed after the UI implementation.
- Preserve the exact selected site in every task/tool/website navigation.
- One current task, up to three other tasks; swap only changes local presentation, never completion or ranking.
- A real empty queue is calm; an unavailable queue is not called empty.
- Actual zero impressions remain zero; absent metrics never become zero or demo examples.
- Full workspace and its original data panels remain available in one click.
- Desktop 1360x1000 and mobile 390x844: no horizontal document overflow, accessible navigation and focus, no serious/critical axe issues.
- Full browser fixture checks persist under the repository harness. No production data is used for tests.

Test-change rationale: previous tests specifically verify the original full workspace and are retained behind Open full workspace. The returning-user entry assertions now require the selected coach Home. HomeWorkspace's timezone, calendar and panel order contracts are still tested separately.
