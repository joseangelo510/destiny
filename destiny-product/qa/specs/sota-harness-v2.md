# SOTA harness v2 specification

Decision `D-HARNESS-SOTA-2` upgrades the Destiny harness from a collection of
green gates into a versioned evidence system. The system must make the safe
engineering path the easiest path without rewarding meaningless test volume or
pretending that the introducing PR can verify its own integrity.

## Required development proof

Every behavior or policy change supplies a typed evidence manifest. A required
RED replay identifies a failing test commit, an argv command without shell
evaluation, the expected failure pattern, the relevant tests, and the later
implementation paths. The verifier executes the same focused tests in detached
temporary worktrees at RED and HEAD. RED must fail for the declared reason and
HEAD must pass. Zero collected tests, unexpected failures, timeouts, network
access, or invalid ancestry fail closed.

Only decision-record-only, docs-only, protected revert, and generated inventory
changes may claim RED is not applicable. The diff, rather than prose, decides
whether an exemption is truthful.

## Evidence and tracing

Every harness step emits one start event and one terminal event as JSON Lines.
Events include schema version, run ID, step ID, SHA, monotonic duration, status,
exit code, artifact paths, and sanitized error details. A deterministic summary
hashes the contract, evidence manifest, baseline, trace, and produced receipts.
Secrets and credential-shaped values are replaced before data reaches disk.

Portable and full-gate capability probes emit separate schema-validated receipts.
The full Supabase lane fails before expensive work when neither Docker nor Podman
is responsive; its failure receipt never overwrites portable harness evidence.

## Ratchets

Measured protected-main values initialize each baseline. Ordinary pull requests
may hold or improve quality; they may not worsen it. Test count is informational.
Duration has explicit PR and nightly ceilings. Coverage and mutation apply to
changed code. Skips, quarantines, flaky retries, audit exceptions, duplication,
cycles, architecture violations, warnings, type errors, and complexity debt may
not increase. Every changed executable function also has a ratcheted cyclomatic
complexity ceiling, currently 19; type-only edits are excluded by comparing emitted
JavaScript at protected main and HEAD. Any temporary regression requires a
separate Fable High decision, owner, reason, expiry, and policy label.

Browser journey coverage comes from a typed owner-and-assertion registry. API
contract coverage comes from canonical route tests. The two denominators remain
separate and combine into a route-journey ratchet, so literal route mentions do
not masquerade as executed behavior.

The demonstrated floors are locked at 90% changed-line coverage, 84%
changed-branch coverage, 68% changed mutation, 65.31% API contract coverage,
58.62% browser journey coverage, and 62.82% combined route proof. The versioned
baseline ledger records the receipt and prior value for every upward movement.

## Architecture and observability

Libraries never import delivery UI, components never import route
implementations, Edge Functions never import web delivery code, and routes share
library contracts rather than importing other routes. Cycles fail the gate.

Application logs use a structured event contract with correlation IDs, bounded
error codes, and recursive redaction. Certified browser journeys assert that the
same correlation ID crosses the browser request and application event boundary.
No production telemetry vendor is introduced by this decision.

## Network and flake policy

Tests declare one of four network modes: mocked, local isolated, staging read
only, or authorized live. Undeclared or out-of-mode network access fails. A test
that passes only after retry is flaky and the run stays red. Quarantine requires
an owner, reason, and expiry and consumes a ratcheted budget.

## Rollout integrity limit

The old required checks and Jose's review govern the pull request that introduces
v2. The v2 self-tests protect later pull requests. They are regression evidence,
not a claim that code can make its own introducing change tamper-proof.
