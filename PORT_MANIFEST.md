# Replit Port Manifest

GitHub `main` is the canonical product source. Replit is a deployment target
with intentional platform-specific differences, so every manual port must
review this file before publishing.

## Deployment contract

1. Port the canonical GitHub commit/diff, not a prose restatement.
2. Run `pnpm port:preflight` in Replit before each publish. It blocks when
   Replit's acknowledged manifest is behind GitHub `main`.
3. Verify every changed line below on the live app before calling a port done.

## Product decisions

- **PR #3 — post-audit destination:** completed audits, audit-ready
  notifications, and audit-ready email open `/this-week`. They do not send a
  new user directly to an audit-results or technical-fix page.
- **PR #3 — full-audit access:** `See full audit details` is persistent on the
  This Week page. It is not inside a modal and is not first-visit-only.
- **PR #3 — first-visit orientation:** the modal says `Your audit is done.
  Here’s your plan.` It explains the four categories without task-count or
  completion claims and presents one computed next-step CTA.
