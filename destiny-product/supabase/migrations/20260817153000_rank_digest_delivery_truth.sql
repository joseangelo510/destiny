-- A successful email API request means accepted, not delivered. Persist the
-- provider's latest event so the product can distinguish both states.

alter table public.rank_digest_sends
  drop constraint if exists rank_digest_sends_status_check;

update public.rank_digest_sends set status = 'accepted' where status = 'sent';

alter table public.rank_digest_sends
  add column if not exists provider_event text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add constraint rank_digest_sends_status_check
    check (status in ('sending', 'accepted', 'delivered', 'failed', 'skipped'));

alter table public.notification_preferences
  drop constraint if exists notification_preferences_last_digest_status_check;

update public.notification_preferences set last_digest_status = 'accepted' where last_digest_status = 'sent';

alter table public.notification_preferences
  add constraint notification_preferences_last_digest_status_check
    check (last_digest_status in ('never', 'accepted', 'delivered', 'failed', 'skipped'));

comment on column public.rank_digest_sends.provider_event is
  'Latest Resend event. accepted is not treated as confirmed delivery.';

-- The launch report is weekly. Preserve explicit opt-outs while moving the
-- earlier three-day experiment onto the documented MVP cadence.
update public.notification_preferences
set ranking_digest_frequency = 'weekly', updated_at = now()
where ranking_digest_frequency = 'three_day';
