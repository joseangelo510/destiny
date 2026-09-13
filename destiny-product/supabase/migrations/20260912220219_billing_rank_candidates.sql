-- Filter before LIMIT so unpaid, excess and exhausted targets cannot starve paid work.
-- This is a read-only shortlist; reserve_rank_check still locks and rechecks every claim.
create function public.billing_rank_candidates()
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with entitled as (
    select a.owner_id,a.status,
      case when a.status='trialing' then 10
        when a.plan='starter' then 25 when a.plan='growth' then 75 when a.plan='premium' then 200 end capacity,
      case when a.status='trialing' then 'trial:'||extract(epoch from a.trial_started_at)::text
        else 'paid:'||extract(epoch from a.period_start)::text end period_key,
      case when a.status='trialing' then interval '3 days' else interval '7 days' end cadence
    from public.billing_accounts a
    where a.plan in ('starter','growth','premium') and a.period_start<=now() and (
      (a.status='trialing' and a.trial_started_at<=now() and a.trial_end>now()) or
      (a.status='active' and a.period_end>now() and a.paid_through>now())
    )
  ), ranked as (
    select t.*,w.normalized_domain,a.owner_id,a.status account_status,a.capacity,a.period_key,a.cadence,
      row_number() over(partition by a.owner_id order by t.created_at,t.id) ordinal
    from public.tracked_keywords t
    join public.websites w on w.id=t.website_id
    join public.organizations o on o.id=w.organization_id
    join entitled a on a.owner_id=o.owner_id
    where t.status<>'paused'
  )
  select jsonb_build_object('id',r.id,'website_id',r.website_id,'keyword',r.keyword,
    'location_code',r.location_code,'language_code',r.language_code,'device',r.device,
    'search_depth',100,'websites',jsonb_build_object('normalized_domain',r.normalized_domain))
  from ranked r
  where r.ordinal<=r.capacity and r.next_check_at<=now()
    and (select count(*) from public.billing_usage u where u.owner_id=r.owner_id and u.meter='rankChecks' and u.period_key=r.period_key)
      < case when r.account_status='trialing' then 20 else r.capacity*5 end
    and not exists(select 1 from public.billing_usage u where u.owner_id=r.owner_id and u.meter='rankChecks'
      and u.request_key like 'rank:'||r.id::text||':%' and u.created_at>now()-r.cadence)
    and (r.account_status<>'trialing' or (select count(*) from public.billing_usage u
      where u.owner_id=r.owner_id and u.meter='rankChecks' and u.period_key=r.period_key
      and u.request_key like 'rank:'||r.id::text||':%')<2)
  order by r.next_check_at,r.id limit 100;
$$;
revoke all on function public.billing_rank_candidates() from public,anon,authenticated;
grant execute on function public.billing_rank_candidates() to service_role;
