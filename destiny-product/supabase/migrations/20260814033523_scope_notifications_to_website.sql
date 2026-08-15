alter table public.notifications
  add column if not exists website_id uuid references public.websites(id) on delete cascade;

create index if not exists notifications_website_created_idx
  on public.notifications (website_id, created_at desc)
  where website_id is not null;

-- Recover the exact site for audit notifications that already link to an audit.
update public.notifications notification
set website_id = audit.website_id
from public.audits audit
where notification.website_id is null
  and notification.destination_path = '/audits/' || audit.id::text
  and notification.organization_id = (
    select website.organization_id from public.websites website where website.id = audit.website_id
  );

-- Do not guess a website for ambiguous legacy notifications. Rows without an
-- exact audit destination remain account-level and are intentionally excluded
-- from every website feed.

create or replace function private.scope_notification_to_website()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_audit_id_text text;
begin
  if new.website_id is null and new.destination_path ~ '^/audits/[0-9a-fA-F-]{36}' then
    v_audit_id_text := substring(new.destination_path from '^/audits/([0-9a-fA-F-]{36})');
    select audit.website_id into new.website_id
    from public.audits audit
    join public.websites website on website.id = audit.website_id
    where audit.id::text = v_audit_id_text
      and website.organization_id = new.organization_id;
  end if;

  if new.website_id is null and new.kind in ('audit_progress', 'audit_ready', 'quest_due') then
    select audit.website_id into new.website_id
    from public.audits audit
    join public.websites website on website.id = audit.website_id
    where website.organization_id = new.organization_id
      and audit.requested_by = new.user_id
    order by coalesce(audit.completed_at, audit.started_at, audit.created_at) desc
    limit 1;
  end if;

  if new.website_id is null and new.kind = 'integration' then
    select integration.website_id into new.website_id
    from public.integrations integration
    where integration.organization_id = new.organization_id
      and integration.website_id is not null
    order by integration.updated_at desc
    limit 1;
  end if;

  if new.website_id is not null and not exists (
    select 1 from public.websites website
    where website.id = new.website_id
      and website.organization_id = new.organization_id
  ) then
    raise exception 'Notification website does not belong to its organization.';
  end if;

  return new;
end;
$$;

revoke all on function private.scope_notification_to_website() from public, anon, authenticated;

drop trigger if exists notifications_scope_website on public.notifications;
create trigger notifications_scope_website
  before insert or update of website_id, organization_id, destination_path
  on public.notifications
  for each row execute function private.scope_notification_to_website();
