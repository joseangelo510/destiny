-- Evidence-backed weekly Google rank tracking.
-- A null list_id is the built-in General list, so every website has a useful
-- default without creating redundant rows.

create table public.rank_tracker_lists (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rank_tracker_lists_unique_name_idx
  on public.rank_tracker_lists (website_id, lower(trim(name)));
create index rank_tracker_lists_website_idx
  on public.rank_tracker_lists (website_id, created_at);

create table public.tracked_keywords (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  list_id uuid references public.rank_tracker_lists(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  keyword text not null check (char_length(trim(keyword)) between 1 and 500),
  normalized_keyword text not null check (char_length(trim(normalized_keyword)) between 1 and 500),
  source text not null default 'manual' check (source in ('strategy', 'research', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'error')),
  location_code integer not null default 2840,
  location_name text not null default 'United States',
  language_code text not null default 'en',
  device text not null default 'desktop' check (device in ('desktop', 'mobile')),
  search_depth integer not null default 100 check (search_depth between 10 and 200),
  first_reading_due_at timestamptz not null default (now() + interval '24 hours'),
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, normalized_keyword, location_code, language_code, device)
);

create index tracked_keywords_due_idx
  on public.tracked_keywords (next_check_at)
  where status in ('pending', 'active', 'error');
create index tracked_keywords_website_idx
  on public.tracked_keywords (website_id, status, created_at);
create index tracked_keywords_list_idx
  on public.tracked_keywords (list_id, status);

create table public.rank_observations (
  id uuid primary key default gen_random_uuid(),
  tracked_keyword_id uuid not null references public.tracked_keywords(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  observed_at timestamptz not null,
  found boolean not null,
  position integer check (position between 1 and 200),
  result_url text,
  result_title text,
  search_depth integer not null check (search_depth between 10 and 200),
  provider text not null default 'dataforseo',
  provider_task_id text,
  provider_cost numeric(12, 6),
  check_url text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((found and position is not null) or (not found and position is null))
);

create index rank_observations_keyword_time_idx
  on public.rank_observations (tracked_keyword_id, observed_at desc);
create index rank_observations_website_time_idx
  on public.rank_observations (website_id, observed_at desc);

create table public.rank_tracker_runs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'partial', 'failed')),
  requested_count integer not null default 0 check (requested_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  provider_cost numeric(12, 6) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index rank_tracker_runs_website_time_idx
  on public.rank_tracker_runs (website_id, created_at desc);

create trigger rank_tracker_lists_touch_updated_at before update on public.rank_tracker_lists
  for each row execute procedure private.touch_updated_at();
create trigger tracked_keywords_touch_updated_at before update on public.tracked_keywords
  for each row execute procedure private.touch_updated_at();

alter table public.rank_tracker_lists enable row level security;
alter table public.tracked_keywords enable row level security;
alter table public.rank_observations enable row level security;
alter table public.rank_tracker_runs enable row level security;

create policy "rank_tracker_lists_select_members" on public.rank_tracker_lists
  for select to authenticated using (
    exists (select 1 from public.websites website
      where website.id = rank_tracker_lists.website_id
        and private.is_organization_member(website.organization_id))
  );
create policy "rank_tracker_lists_insert_members" on public.rank_tracker_lists
  for insert to authenticated with check (
    created_by = (select auth.uid()) and
    exists (select 1 from public.websites website
      where website.id = rank_tracker_lists.website_id
        and private.is_organization_member(website.organization_id))
  );
create policy "rank_tracker_lists_update_members" on public.rank_tracker_lists
  for update to authenticated using (
    exists (select 1 from public.websites website
      where website.id = rank_tracker_lists.website_id
        and private.is_organization_member(website.organization_id))
  ) with check (
    exists (select 1 from public.websites website
      where website.id = rank_tracker_lists.website_id
        and private.is_organization_member(website.organization_id))
  );
create policy "rank_tracker_lists_delete_members" on public.rank_tracker_lists
  for delete to authenticated using (
    exists (select 1 from public.websites website
      where website.id = rank_tracker_lists.website_id
        and private.is_organization_member(website.organization_id))
  );

create policy "tracked_keywords_select_members" on public.tracked_keywords
  for select to authenticated using (
    exists (select 1 from public.websites website
      where website.id = tracked_keywords.website_id
        and private.is_organization_member(website.organization_id))
  );
create policy "tracked_keywords_insert_members" on public.tracked_keywords
  for insert to authenticated with check (
    created_by = (select auth.uid()) and
    exists (select 1 from public.websites website
      where website.id = tracked_keywords.website_id
        and private.is_organization_member(website.organization_id)) and
    (list_id is null or exists (select 1 from public.rank_tracker_lists list
      where list.id = tracked_keywords.list_id and list.website_id = tracked_keywords.website_id))
  );
create policy "tracked_keywords_update_members" on public.tracked_keywords
  for update to authenticated using (
    exists (select 1 from public.websites website
      where website.id = tracked_keywords.website_id
        and private.is_organization_member(website.organization_id))
  ) with check (
    exists (select 1 from public.websites website
      where website.id = tracked_keywords.website_id
        and private.is_organization_member(website.organization_id)) and
    (list_id is null or exists (select 1 from public.rank_tracker_lists list
      where list.id = tracked_keywords.list_id and list.website_id = tracked_keywords.website_id))
  );
create policy "tracked_keywords_delete_members" on public.tracked_keywords
  for delete to authenticated using (
    exists (select 1 from public.websites website
      where website.id = tracked_keywords.website_id
        and private.is_organization_member(website.organization_id))
  );

create policy "rank_observations_select_members" on public.rank_observations
  for select to authenticated using (
    exists (select 1 from public.websites website
      where website.id = rank_observations.website_id
        and private.is_organization_member(website.organization_id))
  );
create policy "rank_tracker_runs_select_members" on public.rank_tracker_runs
  for select to authenticated using (
    exists (select 1 from public.websites website
      where website.id = rank_tracker_runs.website_id
        and private.is_organization_member(website.organization_id))
  );

grant select, insert, update, delete on public.rank_tracker_lists to authenticated;
grant select, insert, update, delete on public.tracked_keywords to authenticated;
grant select on public.rank_observations, public.rank_tracker_runs to authenticated;
