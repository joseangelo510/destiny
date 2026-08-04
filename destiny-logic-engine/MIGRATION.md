# Destiny LOGOS migration

LOGOS is Destiny's deterministic policy layer. TypeScript and Supabase remain
responsible for network access, authentication, persistence, secrets, and UI.

## Migration rule

Every policy moves through the same test-driven sequence:

1. Add a failing behavioral or browser/worker parity test.
2. Add the rule to `src/main.lg` with a stable decision or rule identifier.
3. Compile WebAssembly and embed the same artifact in the browser and worker.
4. Make TypeScript consume the LOGOS output instead of re-deciding the policy.
5. Run unit, parity, lint, build, and production end-to-end checks.
6. Save the LOGOS rules version, input hash, input, and output with the audit.

## Migrated policies

- Audit priority, growth stage, quest category, urgency, and explanation.
- Keyword accept/review/reject verdicts and stable rule identifiers.
- Essential competitor-gap qualification.
- Beginner, Moderate, and Super Growth task quotas.
- Exact task manifest and order for each implementation plan.

## Deliberately outside LOGOS

- Crawling and DataForSEO or WordPress HTTP calls.
- Authentication, authorization, Supabase writes, Vault secrets, and emails.
- Human-facing copy interpolation, URLs, and React rendering.
- Stochastic content generation. LOGOS may gate or prioritize it, but should not
  generate prose.

## Next safe candidates

- CMS publishing gate: approved content plus connected CMS plus explicit human
  publish action.
- Audit completeness gate: minimum page, competitor, and evidence thresholds.
- Weekly rollover and escalation policies.

These candidates should move only after their failing contracts are written.
