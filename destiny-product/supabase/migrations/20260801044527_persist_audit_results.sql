-- Transactional worker-only RPCs for the authenticated audit Edge Function.
-- The browser never receives the service role key and authenticated users cannot
-- call these functions directly.

create or replace function public.begin_destiny_audit(
  p_website_id uuid,
  p_user_id uuid,
  p_provider text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_audit_id uuid;
  v_organization_id uuid;
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

  insert into public.audits (
    website_id,
    requested_by,
    provider,
    status,
    progress,
    started_at
  )
  values (
    p_website_id,
    p_user_id,
    p_provider,
    'running',
    10,
    now()
  )
  returning id into v_audit_id;

  insert into public.notifications (
    organization_id,
    user_id,
    kind,
    title,
    body,
    destination_path
  )
  values (
    v_organization_id,
    p_user_id,
    'audit_progress',
    'Your Destiny audit is running',
    'We are analyzing your website, search coverage, and competitors.',
    '/audits/' || v_audit_id::text
  );

  return v_audit_id;
end;
$$;

create or replace function public.finalize_destiny_audit(
  p_audit_id uuid,
  p_user_id uuid,
  p_metrics jsonb,
  p_provider_result jsonb,
  p_growth_stage text,
  p_quest_title text,
  p_quest_category text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_website_id uuid;
  v_organization_id uuid;
  v_quest_id uuid;
begin
  if p_quest_category not in ('technical', 'content', 'distribution', 'reviews', 'measurement') then
    raise exception 'Unsupported quest category.';
  end if;

  select audit.website_id, website.organization_id
    into v_website_id, v_organization_id
  from public.audits audit
  join public.websites website on website.id = audit.website_id
  where audit.id = p_audit_id
    and audit.requested_by = p_user_id
    and audit.status = 'running'
  for update of audit;

  if v_website_id is null then
    raise exception 'Running audit not found.';
  end if;

  insert into public.audit_metrics (
    audit_id,
    critical_issues,
    warnings,
    ranking_keywords,
    new_keywords,
    lost_keywords,
    estimated_organic_traffic,
    referring_domains,
    content_gaps,
    google_reviews,
    raw_provider_payload
  )
  values (
    p_audit_id,
    greatest(0, coalesce((p_metrics ->> 'criticalIssues')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'warnings')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'rankingKeywords')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'newKeywords')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'lostKeywords')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'estimatedOrganicTraffic')::numeric, 0)),
    greatest(0, coalesce((p_metrics ->> 'referringDomains')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'contentGaps')::integer, 0)),
    greatest(0, coalesce((p_metrics ->> 'reviewCount')::integer, 0)),
    jsonb_build_object(
      'providerResult', coalesce(p_provider_result, '{}'::jsonb),
      'growthStage', p_growth_stage
    )
  );

  insert into public.quests (
    website_id,
    audit_id,
    title,
    description,
    category,
    status,
    priority,
    xp,
    due_at
  )
  values (
    v_website_id,
    p_audit_id,
    p_quest_title,
    'Destiny selected this action from your latest audit using the LOGOS rules engine.',
    p_quest_category,
    'todo',
    1,
    25,
    now() + interval '7 days'
  )
  returning id into v_quest_id;

  update public.audits
  set status = 'complete',
      progress = 100,
      completed_at = now(),
      failure_message = null
  where id = p_audit_id;

  insert into public.notifications (
    organization_id,
    user_id,
    kind,
    title,
    body,
    destination_path
  )
  values (
    v_organization_id,
    p_user_id,
    'audit_ready',
    'Your Destiny audit is ready',
    'Your results and first weekly quest are ready to review.',
    '/audits/' || p_audit_id::text
  );

  return v_quest_id;
end;
$$;

create or replace function public.fail_destiny_audit(
  p_audit_id uuid,
  p_user_id uuid,
  p_failure_message text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select website.organization_id
    into v_organization_id
  from public.audits audit
  join public.websites website on website.id = audit.website_id
  where audit.id = p_audit_id
    and audit.requested_by = p_user_id
    and audit.status = 'running'
  for update of audit;

  if v_organization_id is null then
    return;
  end if;

  update public.audits
  set status = 'failed',
      progress = 100,
      completed_at = now(),
      failure_message = left(coalesce(p_failure_message, 'The audit could not be completed.'), 500)
  where id = p_audit_id;

  insert into public.notifications (
    organization_id,
    user_id,
    kind,
    title,
    body,
    destination_path
  )
  values (
    v_organization_id,
    p_user_id,
    'audit_ready',
    'Your Destiny audit needs attention',
    'We could not finish the audit. Open the audit to retry.',
    '/audits/' || p_audit_id::text
  );
end;
$$;

revoke all on function public.begin_destiny_audit(uuid, uuid, text) from public;
revoke all on function public.finalize_destiny_audit(uuid, uuid, jsonb, jsonb, text, text, text) from public;
revoke all on function public.fail_destiny_audit(uuid, uuid, text) from public;

grant execute on function public.begin_destiny_audit(uuid, uuid, text) to service_role;
grant execute on function public.finalize_destiny_audit(uuid, uuid, jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.fail_destiny_audit(uuid, uuid, text) to service_role;
