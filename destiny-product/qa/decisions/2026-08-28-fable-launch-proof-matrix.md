# Fable launch-proof matrix

**Status:** Accepted for MEDIUM test and harness work only

**Date:** August 28, 2026

**Owner:** Claude Fable 5 High, acting as Destiny CTO under `HARNESS_POLICY.md`

**Consultation session:** `a82f2654-6764-4cb5-a584-e343925f26c5`

## Decision

Do not rebuild Destiny's current keyword-research experience. Protected main at
`57666b1078f554ccc4b56ebff96ddd2dbf18f4d4` already includes the useful Ahrefs-
style workflow requested by the owner: sortable demand and ranking signals,
questions and related searches, saved lists, rank-tracker and strategy handoff,
and live first-page competitors with page-type labels.

Close only the remaining proof gaps:

1. exercise all six directed boundaries in the existing three-tenant isolation
   fixture;
2. make the production read-only Playwright lane accept an exact multi-website
   matrix and fail on console, page, site-context, accessibility, or mutation
   errors;
3. add a reusable unauthenticated public-artifact verifier that rejects
   homepages and share-composer URLs and distinguishes saved, drafted,
   scheduled, and publicly verified states; and
4. compile per-site evidence without claiming that a draft or schedule is
   published.

## Classification

- MEDIUM: test additions, Playwright matrix, verifier code, documentation, and
  launch-readiness evidence.
- HIGH and not authorized by this decision: production JWT or secret handling,
  authenticated production execution, live WordPress or social publishing,
  deploys, schema or RLS changes, migrations, tags, redirects, or configuration.

## Stop conditions

Stop on any cross-tenant visibility, mutation attempt, wrong-site content,
console or page error, missing exact-SHA check, unauthenticated response other
than the expected authorization result, public URL mismatch, missing content or
canonical proof, or any requirement for a frozen or HIGH action.

Only an unauthenticated fetch of the exact post URL with its expected content
and site identity may be described as `publicly_verified`.
