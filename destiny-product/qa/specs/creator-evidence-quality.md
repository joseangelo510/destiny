# Creator evidence quality

MEDIUM behavior change on base f69360ff75f96744ade1a3e40c7f75b39cb07f7f, stacked after PR157. Owner goal: real-user acceptance of Rebound SEO's creator discovery. Protected revert rollback. No auth, RLS, billing meter, provider credentials, schema, external outreach, CMS write, or production deployment changes.

Live ClearCheck on 2026-09-23: saved results label a SHRM vendor directory plus Argyle, DISA, and Paychex vendor pages "Independent blog" and enable copy-draft. One ordinary five-search paid refresh completed and showed 20 Medium results, including service promotion, unrelated profile pages, and NYT Open. Only the first priority topic was searched, although the UI listed three topics as "Researches". Billing displayed 30/400 keyword searches after the action; without a same-session pre-action reading, this does not prove an exact five-credit delta.

Acceptance:

1. Saved and newly refreshed results use one truthful user-facing source classification: platform article/video leads remain candidate creator sources with identity/audience/contact unverified; unknown independent websites are reviewable unverified publishers; recognizable vendors/directories are separated from outreach leads and have no copy-draft action. A small known-host set may supplement, but not replace, evidence-based classification. Valid independent websites must remain reviewable.
2. A provider result must match its requested platform host and show topic evidence in title, snippet, or URL. Unrelated profiles and platform homepages are excluded. Returned rows are balanced and bounded across source tasks, so Medium cannot exhaust the full list before other sources.
3. The five-search action states that it researches the first priority keyword, not all three displayed topics; the server retains the existing five-unit meter, request authorization, and website/competitor exclusions.
4. Empty or poor results never become invented creators or verified audiences. Source links remain inspectable. No outreach, external profile, email, or CMS action is performed by this change.

RED tests should exercise actual saved-result rendering, API normalization of live provider rows, and provider parser ordering, relevance and platform-host checks. GREEN implementation should run focused checks, full gate, disposable local browser desktop/mobile acceptance and exact-head hosted PR/staging review. Do not release under this spec alone.
