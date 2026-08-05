-- A failed recovery must preserve the last durable checkpoint. Setting progress
-- to 100 would falsely imply that every research stage completed.
create or replace function public.begin_destiny_audit_v2(
  p_website_id uuid,
  p_user_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_audit_id uuid;
  v_organization_id uuid;
  v_created boolean := false;
begin
  if p_provider not in ('demo', 'dataforseo') then
    raise exception 'Unsupported audit provider.';
  end if;

  select website.organization_id
    into v_organization_id
  from public.websites website
  join public.organization_members membership
    on membership.organization_id = website.organization_id
   and membership.user_id = p_user_id
  where website.id = p_website_id;
  if v_organization_id is null then
    raise exception 'Website access denied.';
  end if;

  update public.audits
  set status = 'failed',
      completed_at = now(),
      failure_message = 'The previous audit stopped before saving the next research checkpoint. Please retry.'
  where website_id = p_website_id
    and status = 'running'
    and updated_at < now() - interval '3 minutes';

  select id into v_audit_id
  from public.audits
  where website_id = p_website_id and status = 'running'
  order by started_at desc
  limit 1;

  if v_audit_id is null then
    insert into public.audits (website_id, requested_by, provider, status, progress, started_at)
    values (p_website_id, p_user_id, p_provider, 'running', 10, now())
    on conflict (website_id) where status = 'running' do nothing
    returning id into v_audit_id;

    if v_audit_id is not null then
      v_created := true;
      insert into public.notifications (organization_id, user_id, kind, title, body, destination_path)
      values (
        v_organization_id,
        p_user_id,
        'audit_progress',
        'Your Destiny audit is running',
        'We are analyzing your website, search coverage, and competitors.',
        '/audits/' || v_audit_id::text
      );
    else
      select id into v_audit_id
      from public.audits
      where website_id = p_website_id and status = 'running'
      order by started_at desc
      limit 1;
    end if;
  end if;

  if v_audit_id is null then
    raise exception 'Destiny could not create or resume the audit.';
  end if;
  return jsonb_build_object('auditId', v_audit_id, 'created', v_created);
end;
$$;

revoke all on function public.begin_destiny_audit_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.begin_destiny_audit_v2(uuid, uuid, text) to service_role;
