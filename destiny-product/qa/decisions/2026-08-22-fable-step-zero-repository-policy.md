# Fable Step Zero repository policy

Decision owner: Claude Fable 5 High, acting as Destiny CTO and product owner.

## Accepted harness

Fable accepted the one-command local/CI gate, same-domain three-site isolation, authenticated browser isolation, negative authorization for all privileged Edge Functions, and offline WordPress/Webflow/Wix behavior. Production and customer sites remain outside the mutating harness.

## Binding repository rules

1. New production code files are capped at 500 lines and new test files at 800. Existing oversized files use a checked-in downward-only baseline. Generated files, migrations, CSS, lockfiles, vendor code, and data-only JSON/snapshot fixtures are exempt.
2. Developer-authored operational and UI strings in `src/app`, `src/components`, and shared UI libraries use Latin script. Runtime customer content, generated CMS copy, keywords, transcripts, multilingual input, tests, and fixtures are outside the rule. Reviewed exceptions use `// i18n-ok: <reason>`.
3. Application database access moves through `src/lib/db`. Site-scoped queries receive a required `websiteId`; remaining raw-client call sites are individually justified in `DB_EXEMPTIONS.md`. RLS remains the primary control.
4. Commit discipline starts after `9991f9314e4c7b2cd210b63a6f68628a6ec6863a`. The activation commit is immutable. RED and QA commits add tests only, GREEN commits contain no tests, and modifications to existing tests require `test-change:` plus Deploy Log justification. Squash merge of PR #7 is prohibited.
5. Every release receives a complete Deploy Log entry with an exact green gate on the shipped SHA. Blank evidence means not shipped.

## Acceptance requirement

Step Zero is accepted only after the adapter allowlist meta-test, CI/local parity assertion, file-length ratchet, English-only rule, typed DB chokepoint and exemptions, commit/skip-marker gate, and Deploy Log template all pass through `pnpm gate` with linked evidence.
