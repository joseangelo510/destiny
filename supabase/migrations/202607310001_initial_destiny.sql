-- Destiny production data model
-- Designed for Supabase Postgres with strict organization-level isolation.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  contact_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  normalized_domain text not null,
  business_name text not null,
  products_services text not null default '',
  ideal_customer text not null default '',
  differentiation text not null default '',
  market text not null default '',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_domain)
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  name text not null,
  url text,
  created_at timestamptz not null default now()
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'dataforseo',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  failure_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audits_website_created_idx on public.audits (website_id, created_at desc);
create index audits_worker_queue_idx on public.audits (status, created_at)
  where status in ('queued', 'running');

create table public.audit_metrics (
  audit_id uuid primary key references public.audits(id) on delete cascade,
  critical_issues integer not null default 0 check (critical_issues >= 0),
  warnings integer not null default 0 check (warnings >= 0),
  ranking_keywords integer not null default 0 check (ranking_keywords >= 0),
  new_keywords integer not null default 0 check (new_keywords >= 0),
  lost_keywords integer not null default 0 check (lost_keywords >= 0),
  estimated_organic_traffic numeric(14, 2) not null default 0,
  referring_domains integer not null default 0 check (referring_domains >= 0),
  content_gaps integer not null default 0 check (content_gaps >= 0),
  google_reviews integer not null default 0 check (google_reviews >= 0),
  raw_provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid references public.audits(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null
    check (category in ('technical', 'content', 'distribution', 'reviews', 'measurement')),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'complete', 'skipped')),
  priority smallint not null default 3 check (priority between 1 and 5),
  xp integer not null default 0 check (xp >= 0),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quests_website_status_idx on public.quests (website_id, status, due_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'audit_progress', 'audit_ready', 'quest_due', 'integration')),
  title text not null,
  body text not null default '',
  destination_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where read_at is null;

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid references public.websites(id) on delete cascade,
  provider text not null
    check (provider in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube')),
  external_account_id text,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'expired', 'revoked', 'error')),
  scopes text[] not null default '{}',
  credential_reference text,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, website_id, provider)
);

-- Security helpers run as the table owner so policy checks do not recurse.
create or replace function public.is_organization_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(target_organization uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization
      and membership.user_id = auth.uid()
      and membership.role = any(allowed_roles)
  );
$$;

-- Organization creation is atomic so there is never an ownerless organization
-- between the organization insert and the first membership insert.
create or replace function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_organization uuid;
  normalized_name text := trim(organization_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if normalized_name = '' or char_length(normalized_name) > 120 then
    raise exception 'Organization name must contain 1 to 120 characters.';
  end if;

  insert into public.organizations (name, owner_id)
  values (normalized_name, auth.uid())
  returning id into created_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization, auth.uid(), 'owner');

  return created_organization;
end;
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, text[]) from public;
revoke all on function public.create_organization(text) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.create_organization(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, contact_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger organizations_touch_updated_at before update on public.organizations
  for each row execute procedure public.touch_updated_at();
create trigger websites_touch_updated_at before update on public.websites
  for each row execute procedure public.touch_updated_at();
create trigger audits_touch_updated_at before update on public.audits
  for each row execute procedure public.touch_updated_at();
create trigger quests_touch_updated_at before update on public.quests
  for each row execute procedure public.touch_updated_at();
create trigger integrations_touch_updated_at before update on public.integrations
  for each row execute procedure public.touch_updated_at();

revoke all on function public.touch_updated_at() from public;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.websites enable row level security;
alter table public.competitors enable row level security;
alter table public.audits enable row level security;
alter table public.audit_metrics enable row level security;
alter table public.quests enable row level security;
alter table public.notifications enable row level security;
alter table public.integrations enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations_select_members" on public.organizations
  for select using (public.is_organization_member(id));
create policy "organizations_update_admins" on public.organizations
  for update using (public.has_organization_role(id, array['owner', 'admin']))
  with check (public.has_organization_role(id, array['owner', 'admin']));

create policy "members_select_members" on public.organization_members
  for select using (public.is_organization_member(organization_id));
create policy "members_insert_owners" on public.organization_members
  for insert with check (public.has_organization_role(organization_id, array['owner']));
create policy "members_insert_admins" on public.organization_members
  for insert with check (
    role in ('admin', 'member') and
    public.has_organization_role(organization_id, array['admin'])
  );
create policy "members_update_owners" on public.organization_members
  for update using (public.has_organization_role(organization_id, array['owner']))
  with check (public.has_organization_role(organization_id, array['owner']));
create policy "members_update_admins" on public.organization_members
  for update using (
    role <> 'owner' and
    public.has_organization_role(organization_id, array['admin'])
  ) with check (
    role in ('admin', 'member') and
    public.has_organization_role(organization_id, array['admin'])
  );
create policy "members_delete_owners" on public.organization_members
  for delete using (public.has_organization_role(organization_id, array['owner']));
create policy "members_delete_admins" on public.organization_members
  for delete using (
    role <> 'owner' and
    public.has_organization_role(organization_id, array['admin'])
  );

create policy "websites_select_members" on public.websites
  for select using (public.is_organization_member(organization_id));
create policy "websites_insert_members" on public.websites
  for insert with check (public.is_organization_member(organization_id));
create policy "websites_update_members" on public.websites
  for update using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

create policy "competitors_select_members" on public.competitors
  for select using (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and public.is_organization_member(website.organization_id))
  );
create policy "competitors_write_members" on public.competitors
  for all using (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and public.is_organization_member(website.organization_id))
  ) with check (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and public.is_organization_member(website.organization_id))
  );

create policy "audits_select_members" on public.audits
  for select using (
    exists (select 1 from public.websites website
      where website.id = audits.website_id
        and public.is_organization_member(website.organization_id))
  );
create policy "audits_insert_members" on public.audits
  for insert with check (
    requested_by = auth.uid() and
    exists (select 1 from public.websites website
      where website.id = audits.website_id
        and public.is_organization_member(website.organization_id))
  );

create policy "audit_metrics_select_members" on public.audit_metrics
  for select using (
    exists (
      select 1 from public.audits audit
      join public.websites website on website.id = audit.website_id
      where audit.id = audit_metrics.audit_id
        and public.is_organization_member(website.organization_id)
    )
  );

create policy "quests_select_members" on public.quests
  for select using (
    exists (select 1 from public.websites website
      where website.id = quests.website_id
        and public.is_organization_member(website.organization_id))
  );
create policy "quests_update_members" on public.quests
  for update using (
    exists (select 1 from public.websites website
      where website.id = quests.website_id
        and public.is_organization_member(website.organization_id))
  ) with check (
    exists (select 1 from public.websites website
      where website.id = quests.website_id
        and public.is_organization_member(website.organization_id))
  );

create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "integrations_select_members" on public.integrations
  for select using (public.is_organization_member(organization_id));
create policy "integrations_write_admins" on public.integrations
  for all using (public.has_organization_role(organization_id, array['owner', 'admin']))
  with check (public.has_organization_role(organization_id, array['owner', 'admin']));

comment on column public.integrations.credential_reference is
  'Reference to an encrypted secret. Never store OAuth access or refresh tokens in this table as plain text.';

-- Browser clients receive only the operations the product needs. RLS then
-- limits those operations to the signed-in user's organizations and records.
revoke all on public.profiles from anon, authenticated;
revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;
revoke all on public.websites from anon, authenticated;
revoke all on public.competitors from anon, authenticated;
revoke all on public.audits from anon, authenticated;
revoke all on public.audit_metrics from anon, authenticated;
revoke all on public.quests from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.integrations from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (first_name, last_name, contact_email) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
grant select, insert, delete on public.organization_members to authenticated;
grant update (role) on public.organization_members to authenticated;
grant select, insert on public.websites to authenticated;
grant update (url, normalized_domain, business_name, products_services, ideal_customer, differentiation, market, onboarding_completed_at) on public.websites to authenticated;
grant select, insert, update, delete on public.competitors to authenticated;
grant select, insert on public.audits to authenticated;
grant select on public.audit_metrics to authenticated;
grant select on public.quests to authenticated;
grant update (status, completed_at) on public.quests to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.integrations to authenticated;
