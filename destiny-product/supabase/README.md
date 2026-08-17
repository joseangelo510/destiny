# Destiny database

The migrations define the production data model, harden internal functions, add
covering indexes, and apply organization-level Row Level Security rules. They
are deployed to the verified `Jose Angelo Studios` Supabase project.

## Security model

- Every customer record belongs to an organization.
- Organization membership is checked by database policies, not only by the UI.
- Audit workers use a server-only service role; browsers never receive that key.
- Google OAuth tokens are not stored directly in the `integrations` table. The
  table stores only a reference to an encrypted credential.
- Raw DataForSEO payloads stay attached to the originating audit for traceability.
- Public authenticated RPCs are security-invoker wrappers. The privileged
  implementations live in the non-exposed `private` schema, validate
  `auth.uid()`, and reject anonymous sessions before bypassing RLS.
- `cms_transfers` is intentionally service-role-only. RLS has no client policy
  because browsers access its safe, organization-scoped projection through the
  authenticated `read_cms_transfer_states` wrapper.

## Tables

- `profiles`, `organizations`, `organization_members`
- `websites`, `competitors`
- `audits`, `audit_metrics`
- `quests`, `notifications`
- `integrations`

Before a public launch, create a separate production project and complete a
qualified security review. The current connected project is the development
environment.
