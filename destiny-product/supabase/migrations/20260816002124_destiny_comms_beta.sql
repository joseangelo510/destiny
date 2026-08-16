-- Destiny closed-beta communications, continuity, preferences, and attribution.
-- All browser-writable rows are isolated to the signed-in user and a website
-- they can access. Delivery workers use the service role and still write the
-- same organization, website, and user scope for auditability.

create table public.comms_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cadence text not null default 'weekly'
    check (cadence in ('essential', 'weekly', 'guided', 'muted')),
  user_timezone text not null default 'UTC'
    check (char_length(user_timezone) between 1 and 80),
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, user_id)
);

create table public.comms_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_week_start date not null,
  week_number integer not null check (week_number between 1 and 53),
  user_timezone text not null check (char_length(user_timezone) between 1 and 80),
  window_start_at timestamptz not null,
  friday_risk_at timestamptz not null,
  sunday_last_chance_at timestamptz not null,
  window_end_at timestamptz not null,
  state text not null default 'open'
    check (state in ('open', 'completed', 'at_risk', 'frozen', 'recovering', 'recovered', 'broken')),
  streak_length integer not null default 0 check (streak_length >= 0),
  qualifying_action_count integer not null default 0 check (qualifying_action_count >= 0),
  recovery_action_count integer not null default 0 check (recovery_action_count between 0 and 2),
  recovery_expires_at timestamptz,
  freezes_remaining integer not null default 2 check (freezes_remaining between 0 and 2),
  freezes_reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, user_id, local_week_start),
  check (window_start_at < friday_risk_at),
  check (friday_risk_at < sunday_last_chance_at),
  check (sunday_last_chance_at < window_end_at),
  check ((state = 'recovering' and recovery_expires_at is not null) or state <> 'recovering')
);

create table public.comms_notification_events (
  event_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  user_timezone text not null check (char_length(user_timezone) between 1 and 80),
  type text not null check (type in (
    'quest.action_completed', 'week.completed', 'week.at_risk',
    'week.last_chance', 'week.frozen', 'week.recovery_offered',
    'week.recovered', 'week.broken', 'scorecard.ready',
    'onboarding.step_ready', 'alarm.indexation_collapse',
    'alarm.crawl_blocked', 'alarm.money_keyword_drop'
  )),
  job text not null check (job in ('continuity', 'reflection', 'direction', 'celebration', 'alarm', 'discovery')),
  priority smallint not null default 0 check (priority between 0 and 2),
  grouping_key text not null check (char_length(grouping_key) between 1 and 240),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 300),
  bypass_batch boolean not null default false,
  render jsonb not null default '{}'::jsonb check (jsonb_typeof(render) = 'object'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, website_id, dedupe_key)
);

create table public.comms_achievements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null check (achievement_key in ('first_useful_step')),
  source_event_id uuid references public.comms_notification_events(event_id) on delete set null,
  earned_at timestamptz not null default now(),
  unique (website_id, user_id, achievement_key)
);

create table public.comms_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.comms_notification_events(event_id) on delete set null,
  message_id text not null check (char_length(message_id) between 1 and 300),
  channel text not null check (channel in ('email', 'push', 'in_app')),
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  transactional boolean not null default false,
  alarm boolean not null default false,
  provider_message_id text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, website_id, message_id, channel)
);

create table public.comms_message_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.comms_notification_events(event_id) on delete set null,
  message_id text not null check (char_length(message_id) between 1 and 300),
  outcome text not null check (outcome in (
    'downstream_completion', 'dismiss', 'mute', 'opt_out',
    'freeze_used', 'recovery_used'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index comms_preferences_user_idx on public.comms_preferences (user_id);
create index comms_weeks_user_current_idx on public.comms_weeks (user_id, website_id, local_week_start desc);
create index comms_weeks_state_deadline_idx on public.comms_weeks (state, window_end_at)
  where state in ('open', 'at_risk', 'recovering');
create index comms_events_batch_idx on public.comms_notification_events (user_id, website_id, bypass_batch, grouping_key, occurred_at desc);
create index comms_events_priority_idx on public.comms_notification_events (priority desc, occurred_at)
  where priority = 2 or bypass_batch;
create index comms_achievements_user_idx on public.comms_achievements (user_id, earned_at desc);
create index comms_deliveries_cap_idx on public.comms_deliveries (user_id, website_id, channel, delivered_at desc);
create index comms_outcomes_message_idx on public.comms_message_outcomes (message_id, occurred_at desc);
create index comms_outcomes_user_idx on public.comms_message_outcomes (user_id, website_id, occurred_at desc);

create trigger comms_preferences_touch_updated_at before update on public.comms_preferences
  for each row execute function private.touch_updated_at();
create trigger comms_weeks_touch_updated_at before update on public.comms_weeks
  for each row execute function private.touch_updated_at();

alter table public.comms_preferences enable row level security;
alter table public.comms_weeks enable row level security;
alter table public.comms_notification_events enable row level security;
alter table public.comms_achievements enable row level security;
alter table public.comms_deliveries enable row level security;
alter table public.comms_message_outcomes enable row level security;

create policy "comms_preferences_select_self" on public.comms_preferences
  for select to authenticated using (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );
create policy "comms_preferences_insert_self" on public.comms_preferences
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );
create policy "comms_preferences_update_self" on public.comms_preferences
  for update to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  ) with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );

create policy "comms_weeks_select_self" on public.comms_weeks
  for select to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  );
create policy "comms_weeks_insert_self" on public.comms_weeks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );
create policy "comms_weeks_update_self" on public.comms_weeks
  for update to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  ) with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );

create policy "comms_events_select_self" on public.comms_notification_events
  for select to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  );
create policy "comms_events_insert_self" on public.comms_notification_events
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );

create policy "comms_achievements_select_self" on public.comms_achievements
  for select to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  );
create policy "comms_achievements_insert_self" on public.comms_achievements
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );

create policy "comms_deliveries_select_self" on public.comms_deliveries
  for select to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  );

create policy "comms_outcomes_select_self" on public.comms_message_outcomes
  for select to authenticated using (
    user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  );
create policy "comms_outcomes_insert_self" on public.comms_message_outcomes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (select 1 from public.websites website where website.id = website_id and website.organization_id = organization_id)
  );

revoke all on public.comms_preferences from anon, authenticated;
revoke all on public.comms_weeks from anon, authenticated;
revoke all on public.comms_notification_events from anon, authenticated;
revoke all on public.comms_achievements from anon, authenticated;
revoke all on public.comms_deliveries from anon, authenticated;
revoke all on public.comms_message_outcomes from anon, authenticated;

grant select, insert on public.comms_preferences to authenticated;
grant update (cadence, user_timezone, email_enabled, push_enabled) on public.comms_preferences to authenticated;
grant select, insert on public.comms_weeks to authenticated;
grant update (
  state, streak_length, qualifying_action_count, recovery_action_count,
  recovery_expires_at, freezes_remaining, freezes_reset_at
) on public.comms_weeks to authenticated;
grant select, insert on public.comms_notification_events to authenticated;
grant select, insert on public.comms_achievements to authenticated;
grant select on public.comms_deliveries to authenticated;
grant select, insert on public.comms_message_outcomes to authenticated;

comment on table public.comms_weeks is 'Per-user, per-website local Week continuity. Reopening a quest never decrements historical action counts.';
comment on table public.comms_notification_events is 'Typed communications event envelope. Priority-2 alarms and bypass_batch events must not wait for batching.';
