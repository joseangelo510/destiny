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

Next.js and Supabase continue to own:

- form validation and URL normalization;
- authentication and authorization;
- database and RLS access;
- DataForSEO and Google API calls;
- background execution, notifications, and email delivery;
- UI rendering and generative content.

## Version 1 decision contract

Inputs are integer signals so the same compiled WebAssembly module can run in
the browser and the Supabase audit worker:

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
6. Deploy the worker and web app.
7. Run real multi-domain audits and verify saved metrics, decision metadata,
   quest, notification, and dashboard output.

## Rollback

The previous WebAssembly artifact and two-output adapter remain recoverable
from the prior Replit checkpoint. No database column is required for this
phase; the complete LOGOS decision is persisted inside the existing raw audit
payload while the current quest columns remain backward compatible.
