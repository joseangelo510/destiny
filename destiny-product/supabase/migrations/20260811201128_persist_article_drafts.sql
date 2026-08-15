create table public.article_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 300),
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, audit_id, keyword)
);

create index article_drafts_website_audit_idx
  on public.article_drafts (website_id, audit_id, updated_at desc);
create index article_drafts_audit_idx on public.article_drafts (audit_id);
create index article_drafts_organization_idx on public.article_drafts (organization_id);
create index article_drafts_user_idx on public.article_drafts (user_id);

create trigger article_drafts_touch_updated_at before update on public.article_drafts
  for each row execute procedure private.touch_updated_at();

alter table public.article_drafts enable row level security;

create policy "article_drafts_select_members" on public.article_drafts
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );

create policy "article_drafts_insert_members" on public.article_drafts
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );

create policy "article_drafts_update_members" on public.article_drafts
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );

revoke all on table public.article_drafts from public, anon, authenticated;
grant select, insert, update on table public.article_drafts to authenticated;
grant select, insert, update, delete on table public.article_drafts to service_role;

comment on table public.article_drafts is
  'Authenticated, website-scoped Content Studio drafts. A generated draft is not publication approval.';
