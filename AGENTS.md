# Destiny agent instructions

Read root `HARNESS_POLICY.md` at the exact working SHA. GOV-1.3 implements owner decision D10.11.

Jose owns approval authority. Codex executes scoped requests and provides honestly attributed technical review. Do not consult Claude/Fable unless Jose explicitly asks again.

- Ordinary UI/UX, features, safe refactors, tests, and docs: MEDIUM.
- Governance, CI/deploy, auth/RLS/security, migrations, secrets/config, sensitive dependencies, releases/production, and ambiguity: HIGH.
- Record owner-authorized HIGH scope in `destiny-product/DEPLOY_LOG.md` before implementation.
- Supabase Auth Site URL, Replit, migrations, `container-staging`, auth/RLS, secrets, tags, and production require explicit scoped approval.
- Use protected PRs, RED/GREEN tests, full harness/isolation, exact-head review, staging identity, policy/checklist guards. No direct main pushes, force pushes, or bypass.
- Owner labels and merge are Jose's decisions. Codex may execute explicit authorization using the policy's transparent record. Plain-language approval is valid; do not require machine-token transcription.
- Never claim a gate passed without a verifiable run URL. Never call merged work deployed without live proof.
- Preserve existing tools, site/tenant isolation, user data, and unrelated work.
