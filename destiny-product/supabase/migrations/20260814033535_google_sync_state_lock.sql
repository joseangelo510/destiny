alter table public.integrations
  drop constraint if exists integrations_status_check;

alter table public.integrations
  add constraint integrations_status_check
  check (status in (
    'pending',
    'connected',
    'syncing',
    'reconnect_required',
    'expired',
    'revoked',
    'error'
  ));

comment on column public.integrations.status is
  'Connection lifecycle. syncing is a short-lived request lock; reconnect_required blocks sync until OAuth succeeds again.';
