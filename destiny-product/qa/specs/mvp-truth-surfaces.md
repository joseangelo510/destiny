# MVP truth surfaces

Classification: MEDIUM, reviewed by Fable 5 under `HARNESS_POLICY.md`.

## Outcome

- A WordPress post is shown as published only after the existing public verification receipt proves it is live.
- A successful reconciliation advances the matching scheduled calendar item once, without changing unrelated items.
- A delivered but not publicly verified post is labeled as delivered to the CMS, not published.
- Social distribution remains available as guided share-composer links and calendar planning, but Destiny never claims provider delivery without a provider receipt.

## Acceptance criteria

1. `verified_live` may transition a matching `scheduled` item to `published`; all other receipt states and all other item states are no-ops.
2. Repeated reconciliation is idempotent.
3. Calendar receipt matching uses `(website_id, article_key)` and never changes an item with a missing or different article key.
4. A `published_unverified` receipt renders as `Delivered to CMS — verification pending`.
5. Existing LinkedIn, X, and Facebook share links remain present.
6. Homepage and Distribution copy describe guided sharing and prepared share kits, never automatic or verified social delivery.
7. No migration, auth/RLS, dependency, policy, deployment, or production change is part of this work.

## Non-goals

- Social provider APIs or delivery receipts.
- Database row cleanup.
- CMS publishing changes beyond truthful reconciliation.
- Production deployment.
