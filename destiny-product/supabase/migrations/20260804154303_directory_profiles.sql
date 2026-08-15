-- Shared public-directory registry for Distribution and Reviews.
-- A saved URL is monitoring evidence, not an OAuth connection.
create table public.directory_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  directory_key text not null check (char_length(directory_key) between 1 and 80),
  profile_url text,
  status text not null default 'not_started'
    check (status in ('not_started', 'saved', 'claimed', 'verified')),
  public_rating numeric(3, 2),
  public_review_count integer check (public_review_count is null or public_review_count >= 0),
  http_status integer check (http_status is null or http_status between 100 and 599),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, directory_key)
);

alter table public.directory_profiles enable row level security;

create policy "directory_profiles_select_members" on public.directory_profiles
  for select to authenticated using (private.is_organization_member(organization_id));

create policy "directory_profiles_write_members" on public.directory_profiles
  for all to authenticated using (private.is_organization_member(organization_id))
  with check (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = directory_profiles.website_id
        and website.organization_id = directory_profiles.organization_id
    )
  );

revoke all on public.directory_profiles from anon, authenticated;
grant select, insert, update, delete on public.directory_profiles to authenticated;

comment on table public.directory_profiles is
  'Public listing URLs and observable snapshots. Rows do not imply a direct provider connection.';
