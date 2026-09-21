# Saved interview recovery

MEDIUM; D10.50. Baseline c3a51270ca85cebd711a5c5d4539063131abb0df.

## User promise

Voice Library offers Resume interview for saved in-progress interviews and Review interview for completed ones. Resume uses saved question, answer and skip evidence to choose the first unanswered question. Reopening a completed interview displays the stored verbatim answers and current insight decisions without rerunning completion or resetting rejections.

Review insight opens its source interview. Confirm/reject controls reflect their saved state and prevent overlapping decisions while a request is pending. A website change resets local interview state. Navigating back to The interview after completion returns to the read-only review; it must not expose a second completion write.

## Data boundary

The new GET uses the existing typed website scope and authenticated claims, additionally selecting the current creator. Every child query uses the same website and interview. No privileged client, auth/RLS change, schema, configuration, billing or dependency change. Retracted answers are excluded, verbatim text is not normalized, and query failures are errors rather than false empty success.

## Evidence

- RED: four desktop/mobile recovery tests fail on the existing production candidate because Resume interview and Review interview do not exist.
- GREEN: resumed progress after one answer plus one skip, another answer followed by reload, exact retained words, wrong-site denial, completed rejection retention, confirmation and reload all pass using disposable database/API persistence.
- Route tests verify caller/site filtering, signed-out denial, unavailable records, failed child queries, retracted-answer exclusion and whitespace preservation.
- Complete hosted harness, exact-head staging and technical review remain required.

## Limits

Article-generation prerequisites, evidence categorization, history pagination, all-skipped interview recovery and direct completion-endpoint idempotence are not certified by this repair. The recovery GET itself performs no writes. A completed interview is never reopened by posting completion again. No client interview, content or CMS changes are made for verification.

Rollback is a protected revert; saved interview data remains intact.
