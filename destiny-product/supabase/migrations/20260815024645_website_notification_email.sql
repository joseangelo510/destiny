alter table public.websites
  add column if not exists notification_email text;

alter table public.websites
  drop constraint if exists websites_notification_email_format;

alter table public.websites
  add constraint websites_notification_email_format check (
    notification_email is null or (
      char_length(notification_email) between 3 and 254
      and notification_email = lower(trim(notification_email))
      and notification_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

grant update (notification_email) on public.websites to authenticated;

comment on column public.websites.notification_email is
  'Website-specific destination for welcome and audit-ready email. Profiles.contact_email remains a legacy fallback.';
