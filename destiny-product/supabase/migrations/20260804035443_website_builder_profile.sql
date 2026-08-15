-- Editable website profile metadata for the Connections page: where the site
-- is built (CMS platform) and which AI tools helped build it. This is user
-- preference data, not an account connection, so it lives on the website row
-- (organization RLS already applies) instead of the integrations table.
-- Idempotent; does not touch existing Google or WordPress connection records.
alter table public.websites
  add column if not exists builder_profile jsonb not null default '{}'::jsonb;

-- Website update grants are column-scoped in this schema, so the new column
-- needs its own grant for authenticated users to save their selections.
grant update (builder_profile) on public.websites to authenticated;

comment on column public.websites.builder_profile is
  'Self-reported site platform and AI builder tools, e.g. {"platform":"wix","builderTools":["chatgpt"]}. Metadata only — never implies an API connection.';
