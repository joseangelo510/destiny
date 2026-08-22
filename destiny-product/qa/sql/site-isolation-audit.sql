-- Read-only launch gate: every row must resolve to the same website and
-- organization as its parent records. Expected result: zero rows.

with mismatches as (
  select 'article_drafts.organization' as check_name, draft.id::text as row_id
  from public.article_drafts draft join public.websites website on website.id = draft.website_id
  where draft.organization_id <> website.organization_id
  union all
  select 'article_drafts.audit', draft.id::text
  from public.article_drafts draft join public.audits audit on audit.id = draft.audit_id
  where draft.website_id <> audit.website_id
  union all
  select 'keyword_decisions.audit', decision.id::text
  from public.keyword_decisions decision join public.audits audit on audit.id = decision.audit_id
  where decision.website_id <> audit.website_id
  union all
  select 'integrations.organization', integration.id::text
  from public.integrations integration join public.websites website on website.id = integration.website_id
  where integration.organization_id <> website.organization_id
  union all
  select 'keyword_preferences.organization', preference.id::text
  from public.keyword_preferences preference join public.websites website on website.id = preference.website_id
  where preference.organization_id <> website.organization_id
  union all
  select 'keyword_preferences.audit', preference.id::text
  from public.keyword_preferences preference join public.audits audit on audit.id = preference.source_audit_id
  where preference.website_id <> audit.website_id
  union all
  select 'publishing_plans.organization', plan.id::text
  from public.publishing_plans plan join public.websites website on website.id = plan.website_id
  where plan.organization_id <> website.organization_id
  union all
  select 'publishing_plans.audit', plan.id::text
  from public.publishing_plans plan join public.audits audit on audit.id = plan.audit_id
  where plan.website_id <> audit.website_id
  union all
  select 'publishing_schedule.plan', item.id::text
  from public.publishing_schedule_items item join public.publishing_plans plan on plan.id = item.plan_id
  where item.website_id <> plan.website_id or item.organization_id <> plan.organization_id or item.audit_id <> plan.audit_id
  union all
  select 'interviews.organization', interview.id::text
  from public.interviews interview join public.websites website on website.id = interview.website_id
  where interview.organization_id <> website.organization_id
  union all
  select 'interviews.audit', interview.id::text
  from public.interviews interview join public.audits audit on audit.id = interview.audit_id
  where interview.audit_id is not null and interview.website_id <> audit.website_id
  union all
  select 'interlink_runs.organization', run.id::text
  from public.interlink_runs run join public.websites website on website.id = run.website_id
  where run.organization_id <> website.organization_id
  union all
  select 'interlink_runs.audit', run.id::text
  from public.interlink_runs run join public.audits audit on audit.id = run.audit_id
  where run.website_id <> audit.website_id
  union all
  select 'cms_transfers.integration', transfer.id::text
  from public.cms_transfers transfer join public.integrations integration on integration.id = transfer.integration_id
  where transfer.website_id <> integration.website_id
  union all
  select 'rank_observations.keyword', observation.id::text
  from public.rank_observations observation join public.tracked_keywords keyword on keyword.id = observation.tracked_keyword_id
  where observation.website_id <> keyword.website_id
  union all
  select 'notification_preferences.organization', preference.website_id::text
  from public.notification_preferences preference join public.websites website on website.id = preference.website_id
  where preference.organization_id <> website.organization_id
  union all
  select 'rank_digest_sends.organization', send.id::text
  from public.rank_digest_sends send join public.websites website on website.id = send.website_id
  where send.organization_id <> website.organization_id
  union all
  select 'notifications.organization', notification.id::text
  from public.notifications notification join public.websites website on website.id = notification.website_id
  where notification.website_id is not null and notification.organization_id <> website.organization_id
  union all
  select 'quests.audit', quest.id::text
  from public.quests quest join public.audits audit on audit.id = quest.audit_id
  where quest.website_id <> audit.website_id
)
select check_name, count(*) as mismatch_count, array_agg(row_id order by row_id) as row_ids
from mismatches
group by check_name
order by check_name;

-- Duplicate domains across organizations are valid test cases. Provider data
-- must still name the exact website attached to each audit, never a sibling
-- record with the same normalized domain.
select
  website.id as website_id,
  website.organization_id,
  website.normalized_domain,
  audit.id as audit_id,
  metrics.raw_provider_payload #>> '{providerResult,domain}' as provider_domain
from public.websites website
join public.audits audit on audit.website_id = website.id and audit.status = 'complete'
join public.audit_metrics metrics on metrics.audit_id = audit.id
where exists (
  select 1 from public.websites duplicate
  where duplicate.normalized_domain = website.normalized_domain
    and duplicate.organization_id <> website.organization_id
)
and coalesce(metrics.raw_provider_payload #>> '{providerResult,domain}', '') <> website.normalized_domain
order by website.normalized_domain, website.id;
