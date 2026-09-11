# Preserved-product Coach integration

September 11, 2026. Planned, not yet merged or deployed. Base main 95ecbd4921b80a688b3aee74b796d8a744259b93.

The selected design adds a calm Coach view around the real site-scoped queue. One current move, its actual state and available duration, why it matters, definition of done, and the next three real moves remain visible. Swapping only selects a different real move. It never writes completion, approvals, dates or evidence. No synthetic streak, fixed duration or automatic publication claims.

The existing full Home dashboard remains reachable directly using /app/home?view=dashboard&site=<id>, from tool navigation and from Coach. Its performance, keywords, competitor and month panels remain original. Switching websites preserves dashboard mode and never carries the previous site's queue selection.

Original tool pages and component bodies remain unchanged. Shared palette and font tokens change appearance only. Keyword Strategy retains route CSS, new-recommendation discovery and filters, all verdict drawers, saved decisions and restore, reoptimization documents, content-plan confirmation and exact-topic Calendar handoff. Content retains all pipeline states, Studio publishing plan and editorial controls. Calendar retains unscheduled topics, start draft, approved-article selection and scheduling. Reviews retains all six directory providers and Google connection controls; Connections retains all provider and CMS destinations.

Required verification: original unit/API regressions, new Coach direct-dashboard and truthful-state tests, existing desktop/mobile browser journeys, original full Home accessibility and two-site checks, complete disposable infrastructure gate. Compare before/after source hashes for key existing pages and visually inspect Coach, Home, Keyword Strategy, Content, Calendar, Reviews, Connections, login and onboarding. Production writes, including content generation and customer publication, are excluded from QA.

Source backup and approved prototype snapshot were created before implementation with SHA256 hashes in output/coach-production/backup/MANIFEST.json in the parent workspace. Restore through a protected revert or the approved immutable prior release; retain all user data.
