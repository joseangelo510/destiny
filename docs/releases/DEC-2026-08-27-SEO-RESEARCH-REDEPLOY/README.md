# SEO research redeploy decision packet

Decision: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY`

Amendment: `DEC-2026-08-27-SEO-RESEARCH-REDEPLOY-A1`

Status: `AUTHORIZED PENDING` — the decision record may proceed through a protected HIGH pull request. No production deployment, rollback, secret change, or release tag has occurred.

## Scope

This packet records the evidence and rollback source for a proposed single-function redeploy of the existing Supabase Edge Function `seo-research`. The proposed source is already present on protected `main` at commit `450ae943fde32ad479692a851e09bc6d58a27944`; this record does not modify product code.

- Canonical repository: `joseangelo510/destiny`
- Source commit: `450ae943fde32ad479692a851e09bc6d58a27944`
- Source repository tree: `2ec2f8919700c7ff7a1fae13d55f99970f45cf1d`
- Source `seo-research` function tree: `903ecae5e0d868f1390fe2128733f71113f13101`
- Supabase project: `etkksjebqgtkkdqznnxa`
- Function: `seo-research`
- Current production function version: `12`
- Current production package SHA-256: `e9e8bea879002b80be9c30e26e9b92754a8f2e61cb784ead2ce7d44840aa4f37`
- JWT verification: `true`
- Fable decision: <https://claude.ai/chat/bbdba982-9e3a-4b70-957c-6e61752fc275>

## Contents

- `FABLE_HIGH_DECISION.md`: binding CTO decision, amendment, gates, stop conditions, and rollback rule.
- `PREFLIGHT_EVIDENCE.md`: source, runtime, cost, traffic, test, and known-gap evidence gathered before the record PR.
- `rollback-v12/`: credential-free source retrieved from the active production function, with a deterministic source manifest.

## Boundary

The record PR is documentation-only. After it merges, deployment remains separately gated by an exact-SHA checkout, re-verification of the active production package and JWT setting, a current provider-balance check, immediate five-kind production smoke tests, UI verification, and the observation windows in the CTO decision. Jose is the only actor who may apply `cto-approved`.
