# Keyword metrics: measured zero and unavailable data

## Scope and defect

KW-02/03, MEDIUM at base c3a51270ca85cebd711a5c5d4539063131abb0df. Missing volume, difficulty, CPC, competition and estimated traffic were parsed as zero. Difficulty averages included missing rows, while the table hid real zero values. With difficulty 20, 0 and missing, the original report says 7 instead of 10.

## Acceptance

Both server and Edge keyword parsers preserve a finite nonnegative reported value, including zero; null, missing, blank and invalid measurements remain null. Summaries use known values only, and entirely unavailable metrics remain unavailable. The table/summary render genuine zero, label missing values Not available, show volume/difficulty row coverage, keep unknown numeric values last in either sort direction, and leave missing CSV cells empty while preserving real zeros. Keyword-mode traffic is explicitly unavailable.

## Compatibility

Only clients requesting metricContractVersion=2 receive nullable Edge keyword responses. The web API forwards that explicit version; old/unsupported requests retain the numeric legacy contract. This protects stale browser tabs and old web releases. The provider request itself is unchanged. Deploying the new web UI against the old Edge function is safe but still receives legacy zero-coerced metrics; the correction is not live until both are deployed. Rollback either component is compatible, though legacy values lose the missing-data distinction. Edge deployment and web release require separate approval.

## Tests and evidence

Initial six parser/summary regressions failed on baseline (commit ba796a6); the 20/0/missing case returned7 and unknown fields returned0. Eight final parser/compatibility tests and five API forwarding/auth tests pass. Actual local production desktop/mobile browser checks cover parser-derived synthetic data, table, summary, bidirectional sort and downloaded CSV. These are deterministic fixture tests, not a live-provider comparison or proof that Chrome's production download warning is resolved.

## Boundaries

No provider pricing/billing, auth/RLS, schema, config, dependency or CMS changes. Existing recommendation ranking heuristics still default unavailable difficulty/CPC internally; this change preserves unknown inputs rather than rewriting ranking. Save/strategy persistence, monthly trend parsing, historical domain traffic, related-search parsing, filter reset, and the original ChatGPT me/you discrepancy remain separate. Reoptimization types accept missing metrics; no broader reoptimization behavior claim. Rollback via protected revert.
