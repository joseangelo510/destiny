create table if not exists public.llm_visibility_tasks (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  source_key text not null check (
    source_key in (
      'owned-site', 'reddit', 'youtube', 'linkedin', 'quora',
      'reviews', 'earned-media', 'wikipedia', 'medium'
    )
  ),
  task_key text not null check (char_length(task_key) between 1 and 80),
  status text not null default 'todo' check (status in ('todo', 'complete')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  proof_url text,
  proof_attached_at timestamptz,
  unique (website_id, source_key, task_key),
  check (
    (status = 'todo' and completed_at is null) or
    (status = 'complete' and completed_at is not null)
  )
);

alter table public.llm_visibility_tasks
  add column if not exists proof_url text,
  add column if not exists proof_attached_at timestamptz;

alter table public.llm_visibility_tasks
  drop constraint if exists llm_visibility_tasks_public_proof_consistency;

alter table public.llm_visibility_tasks
  add constraint llm_visibility_tasks_public_proof_consistency check (
    (proof_url is null and proof_attached_at is null) or
    (
      status = 'complete'
      and proof_url ~ '^https://[^[:space:]]+$'
      and proof_attached_at is not null
    )
  );

create index if not exists llm_visibility_tasks_website_idx
  on public.llm_visibility_tasks (website_id, source_key, status);

drop trigger if exists llm_visibility_tasks_touch_updated_at on public.llm_visibility_tasks;
create trigger llm_visibility_tasks_touch_updated_at
  before update on public.llm_visibility_tasks
  for each row execute procedure private.touch_updated_at();

alter table public.llm_visibility_tasks enable row level security;

drop policy if exists "llm_visibility_tasks_select_members" on public.llm_visibility_tasks;
create policy "llm_visibility_tasks_select_members"
  on public.llm_visibility_tasks
  for select to authenticated
  using (
    exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "llm_visibility_tasks_insert_members" on public.llm_visibility_tasks;
create policy "llm_visibility_tasks_insert_members"
  on public.llm_visibility_tasks
  for insert to authenticated
  with check (
    (completed_by is null or completed_by = (select auth.uid()))
    and exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "llm_visibility_tasks_update_members" on public.llm_visibility_tasks;
create policy "llm_visibility_tasks_update_members"
  on public.llm_visibility_tasks
  for update to authenticated
  using (
    exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  )
  with check (
    (completed_by is null or completed_by = (select auth.uid()))
    and exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  );

revoke all on public.llm_visibility_tasks from public, anon, authenticated;
grant select, insert on public.llm_visibility_tasks to authenticated;
grant update (status, completed_by, completed_at, proof_url, proof_attached_at)
  on public.llm_visibility_tasks to authenticated;
grant select, insert, update, delete on public.llm_visibility_tasks to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'llm_visibility_tasks'
  ) then
    alter publication supabase_realtime add table public.llm_visibility_tasks;
  end if;
end
$$;

comment on table public.llm_visibility_tasks is
  'Website-scoped, evidence-backed progress toward visibility in LLM citation sources.';
