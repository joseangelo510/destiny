-- Restrict new tracking to managed sites while preserving saved targets and history.
-- Filter before LIMIT so unpaid, excess and exhausted targets cannot starve paid work.
-- This is a read-only shortlist; reserve_rank_check still locks and rechecks every claim.
create or replace function public.billing_rank_candidates()
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
    where t.status<>'paused' and public.is_billing_website_managed(a.owner_id,t.website_id)
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

create or replace function public.reserve_rank_check(p_target_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid;
  account public.billing_accounts%rowtype;
  target public.tracked_keywords%rowtype;
  capacity integer;
  period text;
  cadence interval;
  ceiling integer;
  target_position bigint;
  receipt uuid;
  key_prefix text;
begin
  select o.owner_id into owner from public.tracked_keywords t join public.websites w on w.id=t.website_id join public.organizations o on o.id=w.organization_id where t.id=p_target_id;
  if owner is null then return jsonb_build_object('allowed',false,'reason','target_unavailable'); end if;
  select * into account from public.billing_accounts where owner_id=owner for update;
  if not found then return jsonb_build_object('allowed',false,'reason','payment_required'); end if;
  select * into target from public.tracked_keywords where id=p_target_id for update;
  if not found or target.status='paused' or target.next_check_at>now() then return jsonb_build_object('allowed',false,'reason','not_due'); end if;
  if not public.is_billing_website_managed(owner,target.website_id) then return jsonb_build_object('allowed',false,'reason','managed_website_required'); end if;
  if account.status='trialing' and account.plan is not null and account.period_start<=now() and account.trial_started_at<=now() and account.trial_end>now() then
    capacity:=10; period:='trial:'||extract(epoch from account.trial_started_at)::text; cadence:=interval '3 days'; ceiling:=20;
  elsif account.status='active' and account.period_start<=now() and account.period_end>now() and account.paid_through>now() then
    capacity:=case account.plan when 'starter' then 25 when 'growth' then 75 when 'premium' then 200 else 0 end;
    period:='paid:'||extract(epoch from account.period_start)::text; cadence:=interval '7 days'; ceiling:=capacity*5;
  else return jsonb_build_object('allowed',false,'reason','payment_required');
  end if;
  select ordinal into target_position from (
    select t.id,row_number() over(order by t.created_at,t.id) ordinal from public.tracked_keywords t join public.websites w on w.id=t.website_id join public.organizations o on o.id=w.organization_id where o.owner_id=owner and t.status<>'paused' and public.is_billing_website_managed(owner,t.website_id)
  ) ranked where id=p_target_id;
  if target_position is null or target_position>capacity then return jsonb_build_object('allowed',false,'reason','target_limit'); end if;
  key_prefix:='rank:'||p_target_id::text||':';
  -- All outcomes count here: a failed provider attempt must not open an unlimited retry loop.
  if (select count(*) from public.billing_usage where owner_id=owner and meter='rankChecks' and period_key=period)>=ceiling then return jsonb_build_object('allowed',false,'reason','check_limit'); end if;
  if exists(select 1 from public.billing_usage where owner_id=owner and meter='rankChecks' and request_key like key_prefix||'%' and created_at>now()-cadence) then return jsonb_build_object('allowed',false,'reason','not_due'); end if;
  if account.status='trialing' and (select count(*) from public.billing_usage where owner_id=owner and meter='rankChecks' and period_key=period and request_key like key_prefix||'%')>=2 then return jsonb_build_object('allowed',false,'reason','check_limit'); end if;
  receipt:=gen_random_uuid();
  insert into public.billing_usage(id,owner_id,website_id,request_key,meter,period_key,units) values(receipt,owner,target.website_id,key_prefix||receipt::text,'rankChecks',period,1);
  update public.tracked_keywords set next_check_at=now()+cadence,search_depth=100 where id=p_target_id;
  return jsonb_build_object('allowed',true,'id',receipt,'nextCheckAt',now()+cadence);
end;
$$;
revoke all on function public.reserve_rank_check(uuid) from public,anon,authenticated;
grant execute on function public.reserve_rank_check(uuid) to service_role;

-- Private trigger: enforce activation across API routes and direct authenticated writes.
-- This internal lookup needs owner billing visibility, but never returns billing data.
create or replace function private.enforce_tracking_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  organization uuid;
  owner uuid;
  account public.billing_accounts%rowtype;
  capacity integer := 0;
  used bigint;
begin
  if new.status = 'paused' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'paused' and old.website_id = new.website_id
      and old.normalized_keyword = new.normalized_keyword
      and old.location_code = new.location_code and old.language_code = new.language_code
      and old.device = new.device then return new; end if;
  end if;
  select w.organization_id,o.owner_id into organization,owner
    from public.websites w join public.organizations o on o.id=w.organization_id
    where w.id=new.website_id;
  if owner is null then raise exception 'Website not available.' using errcode='42501'; end if;
  if viewer is not null then
    if not exists(select 1 from public.organization_members m where m.organization_id=organization and m.user_id=viewer) then
      raise exception 'Website not available.' using errcode='42501';
    end if;
  elsif coalesce(current_setting('role',true),'') not in ('service_role','none') then
    raise exception 'Sign in again to continue.' using errcode='42501';
  end if;
  select * into account from public.billing_accounts where owner_id=owner for update;
  if found then
    if account.status='trialing' and account.plan is not null and account.period_start<=now()
      and account.trial_started_at<=now() and account.trial_end>now() then capacity:=10;
    elsif account.status='active' and account.period_start<=now() and account.period_end>now() and account.paid_through>now() then
      capacity:=case account.plan when 'starter' then 25 when 'growth' then 75 when 'premium' then 200 else 0 end;
    end if;
  end if;
  if capacity=0 then
    new.status:='paused'; new.last_error:='Tracking paused: an active subscription or trial is required.';
    return new;
  end if;
  if not public.is_billing_website_managed(owner,new.website_id) then
    new.status:='paused'; new.last_error:='Tracking paused: the owner must select this site under Managed websites in billing.';
    return new;
  end if;
  select count(*) into used from public.tracked_keywords t
    join public.websites w on w.id=t.website_id join public.organizations o on o.id=w.organization_id
    where o.owner_id=owner and public.is_billing_website_managed(owner,t.website_id) and t.status<>'paused' and t.id<>new.id
      and not (t.website_id=new.website_id and t.normalized_keyword=new.normalized_keyword
        and t.location_code=new.location_code and t.language_code=new.language_code and t.device=new.device);
  if used>=capacity then
    new.status:='paused'; new.last_error:='Tracking paused: the account tracking limit has been reached. Pause another keyword or review your plan.';
  else
    new.last_error:=null;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_tracking_capacity() from public,anon,authenticated;
