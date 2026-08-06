-- Weekly execution system: persist a chosen pace and fully actionable audit tasks.
alter table public.websites
  add column plan_tier text check (plan_tier in ('beginner', 'moderate', 'super_growth')),
  add column plan_selected_at timestamptz;

alter table public.audits
  add column logic_rules_version text,
  add column logic_input_hash text;

alter table public.quests
  add column task_type text not null default 'primary_quest'
    check (task_type in ('vocabulary_review', 'content_review', 'primary_quest', 'distribution', 'keyword_review', 'reviews', 'measurement')),
  add column action_path text not null default '/app',
  add column estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 480),
  add column requires_approval boolean not null default false,
  add column external_url text,
  add column min_plan_tier smallint not null default 1 check (min_plan_tier between 1 and 3),
  add column week_number integer not null default 1 check (week_number between 1 and 52);

grant update (plan_tier, plan_selected_at) on public.websites to authenticated;

create or replace function public.finalize_destiny_audit_v2(
  p_audit_id uuid,
  p_user_id uuid,
  p_metrics jsonb,
  p_provider_result jsonb,
  p_growth_stage text,
  p_tasks jsonb,
  p_rules_version text,
  p_logic_input_hash text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_website_id uuid;
  v_organization_id uuid;
  v_task jsonb;
  v_task_count integer := 0;
  v_category text;
begin
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
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) < 3 or jsonb_array_length(p_tasks) > 8 then
    raise exception 'Destiny requires three to eight weekly tasks.';
  end if;

  insert into public.audit_metrics (
    audit_id, critical_issues, warnings, ranking_keywords, new_keywords,
    lost_keywords, estimated_organic_traffic, referring_domains, content_gaps,
    google_reviews, raw_provider_payload
  ) values (
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
    jsonb_build_object('providerResult', coalesce(p_provider_result, '{}'::jsonb), 'growthStage', p_growth_stage)
  );

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    v_category := coalesce(v_task ->> 'category', 'measurement');
    if v_category not in ('technical', 'content', 'distribution', 'reviews', 'measurement') then
      raise exception 'Unsupported quest category.';
    end if;
    insert into public.quests (
      website_id, audit_id, title, description, category, status, priority, xp,
      due_at, task_type, action_path, estimated_minutes, requires_approval,
      external_url, min_plan_tier, week_number
    ) values (
      v_website_id,
      p_audit_id,
      left(coalesce(v_task ->> 'title', 'Complete the next Destiny task'), 240),
      left(coalesce(v_task ->> 'why', ''), 1000),
      v_category,
      'todo',
      least(5, greatest(1, coalesce((v_task ->> 'priority')::integer, 3))),
      least(500, greatest(0, coalesce((v_task ->> 'xp')::integer, 25))),
      now() + interval '7 days',
      coalesce(v_task ->> 'taskType', 'primary_quest'),
      left(coalesce(v_task ->> 'actionPath', '/app'), 500),
      least(480, greatest(1, coalesce((v_task ->> 'estimatedMinutes')::integer, 10))),
      coalesce((v_task ->> 'requiresApproval')::boolean, false),
      nullif(left(coalesce(v_task ->> 'externalUrl', ''), 2048), ''),
      least(3, greatest(1, coalesce((v_task ->> 'minPlanTier')::integer, 1))),
      1
    );
    v_task_count := v_task_count + 1;
  end loop;

  update public.audits
  set status = 'complete', progress = 100, completed_at = now(), failure_message = null,
      logic_rules_version = left(p_rules_version, 80), logic_input_hash = left(p_logic_input_hash, 128)
  where id = p_audit_id;

  insert into public.notifications (organization_id, user_id, kind, title, body, destination_path)
  values (
    v_organization_id, p_user_id, 'audit_ready', 'Your Destiny plan is ready',
    'Choose your weekly pace, then start with the first guided task.', '/this-week'
  );
  return v_task_count;
end;
$$;

revoke all on function public.finalize_destiny_audit_v2(uuid, uuid, jsonb, jsonb, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_destiny_audit_v2(uuid, uuid, jsonb, jsonb, text, jsonb, text, text)
  to service_role;
