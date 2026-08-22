create table if not exists public.interlink_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'complete' check (status in ('running', 'complete', 'failed')),
  pages_checked integer not null default 0 check (pages_checked >= 0),
  manifest jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interlink_opportunities (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.interlink_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  source_url text not null check (char_length(source_url) between 8 and 2048),
  source_title text not null check (char_length(source_title) between 1 and 500),
  target_url text not null check (char_length(target_url) between 8 and 2048),
  target_title text not null check (char_length(target_title) between 1 and 500),
  anchor_text text not null check (char_length(anchor_text) between 1 and 300),
  source_sentence text not null check (char_length(source_sentence) between 1 and 1000),
  reason text not null check (char_length(reason) between 1 and 1000),
  priority_score integer not null default 0,
  priority text not null check (priority in ('high', 'medium', 'low')),
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'skipped', 'done_claimed', 'verified')),
  skip_reason text,
  verified_at timestamptz,
  verified_anchor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, source_url, target_url)
);

create index if not exists interlink_runs_website_idx on public.interlink_runs (website_id, created_at desc);
create index if not exists interlink_opportunities_run_idx on public.interlink_opportunities (run_id, priority_score desc);
create index if not exists interlink_opportunities_website_status_idx on public.interlink_opportunities (website_id, status, updated_at desc);

create trigger interlink_runs_touch_updated_at before update on public.interlink_runs
  for each row execute procedure private.touch_updated_at();
create trigger interlink_opportunities_touch_updated_at before update on public.interlink_opportunities
  for each row execute procedure private.touch_updated_at();

alter table public.interlink_runs enable row level security;
alter table public.interlink_opportunities enable row level security;

create policy "interlink_runs_select_members" on public.interlink_runs
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "interlink_runs_insert_members" on public.interlink_runs
  for insert to authenticated with check (private.is_organization_member(organization_id) and user_id = (select auth.uid()));
create policy "interlink_runs_update_owners" on public.interlink_runs
  for update to authenticated using (private.is_organization_member(organization_id) and user_id = (select auth.uid()))
  with check (private.is_organization_member(organization_id) and user_id = (select auth.uid()));

create policy "interlink_opportunities_select_members" on public.interlink_opportunities
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "interlink_opportunities_insert_members" on public.interlink_opportunities
  for insert to authenticated with check (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.interlink_runs run
      where run.id = interlink_opportunities.run_id
        and run.website_id = interlink_opportunities.website_id
        and run.organization_id = interlink_opportunities.organization_id
        and run.user_id = (select auth.uid())
    )
  );
create policy "interlink_opportunities_update_members" on public.interlink_opportunities
  for update to authenticated using (private.is_organization_member(organization_id))
  with check (private.is_organization_member(organization_id));

revoke all on table public.interlink_runs from public, anon, authenticated;
revoke all on table public.interlink_opportunities from public, anon, authenticated;
grant select, insert, update on table public.interlink_runs to authenticated;
grant select, insert, update on table public.interlink_opportunities to authenticated;
grant select, insert, update, delete on table public.interlink_runs to service_role;
grant select, insert, update, delete on table public.interlink_opportunities to service_role;

comment on table public.interlink_runs is 'Website-scoped, bounded internal-link scans over verified pages.';
comment on table public.interlink_opportunities is 'Reviewable internal-link edits with separate claimed and live-verified states.';
