-- User-controlled keyword ranking emails with a durable, tenant-scoped send ledger.

create table public.notification_preferences (
  website_id uuid primary key references public.websites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ranking_digest_frequency text not null default 'weekly'
    check (ranking_digest_frequency in ('three_day', 'weekly', 'off')),
  timezone text not null default 'America/Los_Angeles'
    check (char_length(trim(timezone)) between 1 and 100),
  next_digest_at timestamptz,
  last_digest_sent_at timestamptz,
  last_digest_status text not null default 'never'
    check (last_digest_status in ('never', 'sent', 'failed', 'skipped')),
  last_digest_error text,
  first_digest_notice_pending boolean not null default false,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_preferences_due_idx
  on public.notification_preferences (next_digest_at)
  where ranking_digest_frequency <> 'off';
create index notification_preferences_organization_idx
  on public.notification_preferences (organization_id, website_id);

create table public.rank_digest_sends (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_key text not null check (char_length(period_key) between 1 and 80),
  recipient text not null,
  is_test boolean not null default false,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'skipped')),
  keywords_compared integer not null default 0 check (keywords_compared >= 0),
  moved_up integer not null default 0 check (moved_up >= 0),
  moved_down integer not null default 0 check (moved_down >= 0),
  entered_top_10 integer not null default 0 check (entered_top_10 >= 0),
  left_top_10 integer not null default 0 check (left_top_10 >= 0),
  provider_message_id text,
  error text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (website_id, period_key, is_test, recipient)
);

create index rank_digest_sends_website_time_idx
  on public.rank_digest_sends (website_id, created_at desc);

create trigger notification_preferences_touch_updated_at before update on public.notification_preferences
  for each row execute procedure private.touch_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.rank_digest_sends enable row level security;

create policy "notification_preferences_select_members" on public.notification_preferences
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "notification_preferences_update_members" on public.notification_preferences
  for update to authenticated using (private.is_organization_member(organization_id))
  with check (private.is_organization_member(organization_id));
create policy "rank_digest_sends_select_members" on public.rank_digest_sends
  for select to authenticated using (private.is_organization_member(organization_id));

grant select on public.notification_preferences, public.rank_digest_sends to authenticated;
grant update (ranking_digest_frequency, next_digest_at, unsubscribed_at, updated_at)
  on public.notification_preferences to authenticated;

create or replace function private.create_website_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (
    website_id, organization_id, ranking_digest_frequency, next_digest_at
  ) values (
    new.id, new.organization_id, 'weekly', now()
  ) on conflict (website_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_website_notification_preferences() from public;

create trigger websites_create_notification_preferences
  after insert on public.websites
  for each row execute procedure private.create_website_notification_preferences();

-- Existing customers receive the requested three-day default and can change or
-- disable it from Account settings. New websites default to weekly.
insert into public.notification_preferences (
  website_id,
  organization_id,
  ranking_digest_frequency,
  next_digest_at,
  first_digest_notice_pending
)
select id, organization_id, 'three_day', now(), true
from public.websites
on conflict (website_id) do update
set ranking_digest_frequency = 'three_day',
    next_digest_at = coalesce(public.notification_preferences.next_digest_at, now()),
    first_digest_notice_pending = true,
    unsubscribed_at = null,
    updated_at = now();

update public.tracked_keywords
set next_check_at = least(next_check_at, now()), updated_at = now()
where status in ('pending', 'active', 'error');

comment on table public.notification_preferences is
  'Per-website user controls and delivery state for Destiny ranking digests.';
comment on table public.rank_digest_sends is
  'Idempotent delivery ledger for ranking digest attempts and provider receipts.';
