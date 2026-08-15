-- Replace the redundant first-week business confirmation with a categorized
-- execution plan and persist explicit keyword approve/decline decisions.
alter table public.quests
  drop constraint if exists quests_task_type_check;

alter table public.quests
  add constraint quests_task_type_check check (
    task_type in (
      'business_confirmation', 'vocabulary_review', 'content_review',
      'primary_quest', 'distribution', 'keyword_review', 'reviews', 'measurement',
      'community_distribution', 'social_distribution', 'publisher_outreach',
      'directory_growth'
    )
  );

create table public.keyword_decisions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 500),
  decision text not null check (decision in ('approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, keyword)
);

create index keyword_decisions_user_idx on public.keyword_decisions (user_id);
create index keyword_decisions_website_idx on public.keyword_decisions (website_id);

create trigger keyword_decisions_touch_updated_at before update on public.keyword_decisions
  for each row execute procedure private.touch_updated_at();

alter table public.keyword_decisions enable row level security;

create policy "keyword_decisions_select_own" on public.keyword_decisions
  for select to authenticated using (
    user_id = (select auth.uid()) and
    exists (
      select 1 from public.audits audit
      where audit.id = keyword_decisions.audit_id
        and audit.website_id = keyword_decisions.website_id
        and audit.requested_by = (select auth.uid())
    )
  );

create policy "keyword_decisions_insert_own" on public.keyword_decisions
  for insert to authenticated with check (
    user_id = (select auth.uid()) and
    exists (
      select 1 from public.audits audit
      where audit.id = keyword_decisions.audit_id
        and audit.website_id = keyword_decisions.website_id
        and audit.requested_by = (select auth.uid())
    )
  );

create policy "keyword_decisions_update_own" on public.keyword_decisions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and
    exists (
      select 1 from public.audits audit
      where audit.id = keyword_decisions.audit_id
        and audit.website_id = keyword_decisions.website_id
        and audit.requested_by = (select auth.uid())
    )
  );

grant select, insert, update on public.keyword_decisions to authenticated;
