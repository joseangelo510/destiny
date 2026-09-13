-- New digest work must be eligible before batching; prior receipts reconcile separately.
create function public.billing_digest_candidates(p_website_id uuid default null)
returns setof jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('website_id',p.website_id,'organization_id',w.organization_id,
    'ranking_digest_frequency',p.ranking_digest_frequency,'last_digest_sent_at',p.last_digest_sent_at,
    'first_digest_notice_pending',p.first_digest_notice_pending,
    'websites',jsonb_build_object('business_name',w.business_name,'normalized_domain',w.normalized_domain,'notification_email',w.notification_email))
  from public.notification_preferences p
  join public.websites w on w.id=p.website_id and w.organization_id=p.organization_id
  join public.organizations o on o.id=w.organization_id
  join public.billing_accounts a on a.owner_id=o.owner_id
  where p.ranking_digest_frequency<>'off'
    and (case when p_website_id is null then p.next_digest_at<=now() else p.website_id=p_website_id end)
    and a.plan in ('starter','growth','premium') and a.period_start<=now()
    and ((a.status='trialing' and a.trial_started_at<=now() and a.trial_end>now())
      or (a.status='active' and a.period_end>now() and a.paid_through>now()))
    and public.is_billing_website_managed(o.owner_id,w.id)
  order by p.next_digest_at,p.website_id limit 50;
$$;
revoke all on function public.billing_digest_candidates(uuid) from public,anon,authenticated;
grant execute on function public.billing_digest_candidates(uuid) to service_role;
