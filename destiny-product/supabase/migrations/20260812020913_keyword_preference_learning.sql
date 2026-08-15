alter table public.keyword_decisions
  add column if not exists reason text
  check (reason is null or reason in (
    'wrong_audience', 'not_offered', 'too_competitive', 'already_covered', 'not_now'
  ));

create table public.keyword_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_audit_id uuid references public.audits(id) on delete set null,
  keyword text not null check (char_length(keyword) between 1 and 500),
  normalized_keyword text not null check (char_length(normalized_keyword) between 1 and 500),
  decision text not null check (decision in ('approved', 'declined')),
  reason text check (reason is null or reason in (
    'wrong_audience', 'not_offered', 'too_competitive', 'already_covered', 'not_now'
  )),
  theme_id text,
  theme_label text,
  provider_intent text check (provider_intent is null or provider_intent in (
    'transactional', 'commercial', 'navigational', 'informational'
  )),
  search_intent text check (search_intent is null or search_intent in (
    'conversion', 'consideration', 'awareness'
  )),
  search_volume integer check (search_volume is null or search_volume >= 0),
  difficulty integer check (difficulty is null or difficulty between 0 and 100),
  priority_score integer check (priority_score is null or priority_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, normalized_keyword)
);

create index keyword_preferences_organization_idx
  on public.keyword_preferences (organization_id);
create index keyword_preferences_user_idx
  on public.keyword_preferences (user_id);
create index keyword_preferences_website_decision_idx
  on public.keyword_preferences (website_id, decision, updated_at desc);
create index keyword_preferences_source_audit_idx
  on public.keyword_preferences (source_audit_id);

create trigger keyword_preferences_touch_updated_at before update on public.keyword_preferences
  for each row execute procedure private.touch_updated_at();

alter table public.keyword_preferences enable row level security;

create policy "keyword_preferences_select_members" on public.keyword_preferences
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = keyword_preferences.website_id
        and website.organization_id = keyword_preferences.organization_id
    )
  );

create policy "keyword_preferences_insert_members" on public.keyword_preferences
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = keyword_preferences.website_id
        and website.organization_id = keyword_preferences.organization_id
    )
  );

create policy "keyword_preferences_update_members" on public.keyword_preferences
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = keyword_preferences.website_id
        and website.organization_id = keyword_preferences.organization_id
    )
  );

create policy "keyword_preferences_delete_members" on public.keyword_preferences
  for delete to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  );

revoke all on table public.keyword_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.keyword_preferences to authenticated;
grant select, insert, update, delete on table public.keyword_preferences to service_role;

insert into public.keyword_preferences (
  organization_id, website_id, user_id, source_audit_id, keyword,
  normalized_keyword, decision, reason, created_at, updated_at
)
select distinct on (
  decision.website_id,
  lower(regexp_replace(trim(decision.keyword), '\s+', ' ', 'g'))
)
  website.organization_id,
  decision.website_id,
  decision.user_id,
  decision.audit_id,
  decision.keyword,
  lower(regexp_replace(trim(decision.keyword), '\s+', ' ', 'g')),
  decision.decision,
  decision.reason,
  decision.created_at,
  decision.updated_at
from public.keyword_decisions decision
join public.websites website on website.id = decision.website_id
order by
  decision.website_id,
  lower(regexp_replace(trim(decision.keyword), '\s+', ' ', 'g')),
  decision.updated_at desc
on conflict (website_id, normalized_keyword) do nothing;

comment on table public.keyword_preferences is
  'Current website-level keyword choices used to personalize future strategy. Audit-level decisions remain the historical source record.';
