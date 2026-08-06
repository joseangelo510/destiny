# Destiny LOGOS migration

## Goal

Move deterministic SEO policy into LOGOS without moving infrastructure,
security, network access, or generative writing into the rules engine.

## Ownership boundary

LOGOS owns:

- growth-stage selection;
- next-action selection;
- quest category;
- urgency;
- a stable decision code;
- an inspectable explanation for the decision.
- keyword eligibility, intent, revenue priority, and recommendation ordering;
- weekly quest transitions, verification, streaks, coaching order, and celebrations;
- the three-month strategy, editorial scheduling, and forecast confidence;
- roadmap, LLM visibility, source-task, and momentum progression;
- onboarding eligibility, audit-health bands, rank-tracker states, and article quality gates.

Next.js and Supabase continue to own:

- string parsing and URL normalization (LOGOS makes the final onboarding eligibility decision);
- authentication and authorization;
- database and RLS access;
- DataForSEO and Google API calls;
- background execution, notifications, and email delivery;
- UI rendering and generative content.

## Current decision contract

Inputs are normalized integer facts so the same compiled WebAssembly module
runs in the browser, Next.js server, and Supabase audit worker. The typed
adapter and golden parity tests are the authoritative field-order contract.

1. audit complete;
2. critical issues;
3. warnings;
4. ranking keywords;
5. new keywords;
6. lost keywords;
7. content gaps;
8. Google review count.

Outputs, in order:

1. growth stage;
2. decision code;
3. weekly quest;
4. quest category;
5. urgency;
6. explanation.

## Migration sequence

1. Add contract and regression tests and observe them fail.
2. Expand the LOGOS source and compile a new WebAssembly artifact.
3. Update browser and worker adapters to the same typed contract.
4. Remove TypeScript policy that is now produced by LOGOS.
5. Run parity, unit, lint, build, and interpreted LOGOS checks.
6. Tag and push the verified rollback checkpoint.
7. Deploy only after release approval, then run real multi-domain audits and verify saved metrics, decision metadata,
   quest, notification, and dashboard output.

## Rollback

Every promoted domain has an annotated Git tag. The baseline tag and the
phase tags recover source, adapters, generated WASM, tests, and UI together.
No destructive database migration is part of the LOGOS cutover.
