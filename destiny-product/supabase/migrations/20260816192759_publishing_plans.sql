create table public.publishing_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('review_each', 'batch_schedule', 'automatic')),
  status text not null default 'active' check (status in ('active', 'paused', 'attention_needed')),
  timezone text not null default 'America/Los_Angeles' check (char_length(timezone) between 1 and 100),
  holdback_hours integer not null default 72 check (holdback_hours between 72 and 336),
  start_date date not null,
  end_date date not null,
  confirmed_post_count integer not null check (confirmed_post_count between 1 and 12),
  automatic_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, audit_id),
  check (end_date >= start_date),
  check (mode <> 'automatic' or automatic_confirmed_at is not null)
);

create table public.publishing_schedule_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.publishing_plans(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  position integer not null check (position between 1 and 12),
  keyword text not null check (char_length(keyword) between 1 and 300),
  normalized_keyword text not null check (char_length(normalized_keyword) between 1 and 300),
  title text not null check (char_length(title) between 1 and 500),
  content_type text not null check (char_length(content_type) between 1 and 100),
  scheduled_for timestamptz not null,
  state text not null default 'planned' check (state in ('planned', 'drafting', 'needs_review', 'scheduled', 'published', 'failed', 'managed_externally')),
  review_recommended boolean not null default false,
  article_key text,
  remote_id text,
  remote_edit_url text,
  remote_permalink text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, position),
  unique (plan_id, normalized_keyword, position)
);

create index publishing_plans_website_idx on public.publishing_plans (website_id, updated_at desc);
create index publishing_schedule_due_idx on public.publishing_schedule_items (state, scheduled_for) where state in ('planned', 'drafting', 'needs_review', 'failed');
create index publishing_schedule_website_idx on public.publishing_schedule_items (website_id, scheduled_for);

create trigger publishing_plans_touch_updated_at before update on public.publishing_plans
  for each row execute procedure private.touch_updated_at();
create trigger publishing_schedule_items_touch_updated_at before update on public.publishing_schedule_items
  for each row execute procedure private.touch_updated_at();

alter table public.publishing_plans enable row level security;
alter table public.publishing_schedule_items enable row level security;

create policy "publishing_plans_select_members" on public.publishing_plans
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  );

create policy "publishing_plans_insert_members" on public.publishing_plans
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and created_by = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = publishing_plans.website_id
        and website.organization_id = publishing_plans.organization_id
        and audit.id = publishing_plans.audit_id
    )
  );

create policy "publishing_plans_update_members" on public.publishing_plans
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  ) with check (
    created_by = (select auth.uid())
    and private.is_organization_member(organization_id)
  );

create policy "publishing_schedule_select_members" on public.publishing_schedule_items
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  );

create policy "publishing_schedule_insert_members" on public.publishing_schedule_items
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.publishing_plans plan
      where plan.id = publishing_schedule_items.plan_id
        and plan.organization_id = publishing_schedule_items.organization_id
        and plan.website_id = publishing_schedule_items.website_id
        and plan.audit_id = publishing_schedule_items.audit_id
    )
  );

create policy "publishing_schedule_update_members" on public.publishing_schedule_items
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  ) with check (private.is_organization_member(organization_id));

revoke all on table public.publishing_plans from public, anon, authenticated;
revoke all on table public.publishing_schedule_items from public, anon, authenticated;
grant select, insert, update on table public.publishing_plans to authenticated;
grant select, insert, update on table public.publishing_schedule_items to authenticated;
grant select, insert, update, delete on table public.publishing_plans to service_role;
grant select, insert, update, delete on table public.publishing_schedule_items to service_role;

comment on table public.publishing_plans is 'Website-scoped, explicitly confirmed three-month CMS publishing plans.';
comment on table public.publishing_schedule_items is 'Idempotent editorial slots. WordPress remains the source of truth for future publication.';
