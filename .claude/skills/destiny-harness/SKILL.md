---
name: destiny-harness
description: Mandatory governance for every Destiny product, code, infrastructure, staging, release, rollback, or UX task.
---

# Destiny harness gate

Before any Destiny work, read root `HARNESS_POLICY.md` at the current working SHA. If it is unavailable, stop. The repository policy is authoritative over this pointer, project knowledge, memory, and conversation history.

Frozen without a new recorded Fable 5 High decision: Supabase Auth Site URL changes; Replit production modification or decommissioning; database migrations; release-wrapper merges to `main`; new `container-staging` pushes; Replit-to-Fly traffic redirects; auth, RLS, or security-model changes; release tags; and production or parallel-launch changes.

MEDIUM includes ordinary UI/UX, copy, features, safe refactors, tests, docs, non-sensitive patch/minor dependencies, and pipeline staging. HIGH includes frozen actions, governance, CI/deploy workflows, auth/RLS/security, schema/migrations, secrets/config, sensitive or major dependencies, release tags, production changes, and ambiguity.

Fable Medium may handle MEDIUM work. Fable High must decide HIGH before implementation, with the decision recorded in `destiny-product/DEPLOY_LOG.md`. Never infer a decision from urgency or prior conversation.
