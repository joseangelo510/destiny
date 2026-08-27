# MVP website selection and rank recovery

Classification: MEDIUM, reviewed by Fable 5 under `HARNESS_POLICY.md`.

## Outcome

- Destiny presents one deterministic workspace option per normalized domain without deleting or merging stored rows.
- An explicit accessible website UUID always remains authoritative for that request.
- Rank-provider failures use bounded retries and distinguish a temporary retry from a degraded provider state.

## Acceptance criteria

1. Duplicate domains select, in order, an onboarding-complete row, the row with more business context, the most recently updated row, then the lexicographically smallest UUID.
2. The site switcher displays one option per normalized domain.
3. An explicit UUID that belongs to the accessible set bypasses canonical fallback selection.
4. Transient provider failures retry after 1, 6, 24, and 72 hours; after the fourth failure the UI says `Degraded — provider errors`.
5. Permanent authentication, payment, invalid-input, and unsupported errors enter the degraded state without rapid retries.
6. Retry metadata stays compact in the existing `last_error` field; no schema, migration, data cleanup, or website-specific rule is introduced.

## Non-goals

- Deleting, merging, or rewriting website rows.
- Changing rank-provider credentials.
- Database migrations or production deployment.
