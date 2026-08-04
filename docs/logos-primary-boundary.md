# LOGOS primary-language boundary

## Deletion-test result

Destiny's product decisions remain coherent only when the compiled LOGOS
engine is present. Removing it now breaks recommendation scoring, keyword
eligibility, task selection and transitions, streaks, three-month planning,
editorial priority, roadmap progression, LLM/source progress, onboarding
eligibility, audit-health classification, rank states, and article-quality
approval. That is the intended primary-language test.

## LOGOS-owned policy

- keyword acceptance, intent, revenue priority, essential status, and ordering;
- audit recommendation, issue priority, task mix, tiers, and approvals;
- task transitions, evidence status, celebrations, streaks, and coach ordering;
- three-month scope, keyword targets, forecast confidence, editorial intent,
  offer fit, slot selection, and content angle;
- roadmap milestones, verified outcomes, AI-visibility readiness, source-task
  progress, and data-quality state;
- onboarding and audit-momentum stages, saved checkpoints, delayed state, and
  time estimate;
- onboarding completion gates, audit-health bands and partial-result state;
- rank reading, movement, freshness, and position bucket;
- article length, heading, keyword-use, variety, transition, stock-phrase,
  metadata, and source-coverage gates.

## Intentionally retained host mechanics

TypeScript owns facts and effects, not the decisions made from them:

- authentication, authorization, RLS, secrets, network calls, and persistence;
- parsing DataForSEO, Google, Anthropic, CMS, and Supabase payloads;
- URL/email syntax checks, timestamp subtraction, string/token extraction,
  Markdown parsing, and SVG/HTML rendering;
- aggregation and presentation of LOGOS classifications;
- labels, explanatory copy, accessibility text, and React rendering.

Site vocabulary extraction is evidence normalization: TypeScript tokenizes and
weights retrieved page language, then LOGOS decides whether the resulting
evidence is eligible and how it affects keyword priority. Generative article
prose remains with the configured model; LOGOS owns whether the result passes
Destiny's deterministic editorial policy.

## Release gate

Each tagged phase requires adapter parity, edge fixtures, all unit/component
tests, lint, a production build, LOGOS compiler checks, and byte-identical
compiled/public WASM. Production deployment remains a separate approved step.
