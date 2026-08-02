create table public.llm_visibility_tasks (
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
  unique (website_id, source_key, task_key),
  check (
    (status = 'todo' and completed_at is null) or
    (status = 'complete' and completed_at is not null)
  )
);

create index llm_visibility_tasks_website_idx
  on public.llm_visibility_tasks (website_id, source_key, status);

create trigger llm_visibility_tasks_touch_updated_at
  before update on public.llm_visibility_tasks
  for each row execute procedure private.touch_updated_at();

alter table public.llm_visibility_tasks enable row level security;

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

create policy "llm_visibility_tasks_insert_members"
  on public.llm_visibility_tasks
  for insert to authenticated
  with check (
    (completed_by is null or completed_by = (select auth.uid())) and
    exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  );

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
    (completed_by is null or completed_by = (select auth.uid())) and
    exists (
      select 1
      from public.websites website
      join public.organization_members membership
        on membership.organization_id = website.organization_id
      where website.id = llm_visibility_tasks.website_id
        and membership.user_id = (select auth.uid())
    )
  );

grant select, insert on public.llm_visibility_tasks to authenticated;
grant update (status, completed_by, completed_at) on public.llm_visibility_tasks to authenticated;

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
