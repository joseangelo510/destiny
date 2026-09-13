-- Internal tracking receipts persist independently of target deletion.
alter table public.billing_usage drop constraint billing_usage_meter_check;
alter table public.billing_usage add constraint billing_usage_meter_check check (meter in ('articles','keywordSearches','domainReports','shortOutputs','audits','infographics','rankChecks'));
create function public.reserve_rank_check(p_target_id uuid)
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
  if account.status='trialing' and account.plan is not null and account.period_start<=now() and account.trial_started_at<=now() and account.trial_end>now() then
    capacity:=10; period:='trial:'||extract(epoch from account.trial_started_at)::text; cadence:=interval '3 days'; ceiling:=20;
  elsif account.status='active' and account.period_start<=now() and account.period_end>now() and account.paid_through>now() then
    capacity:=case account.plan when 'starter' then 25 when 'growth' then 75 when 'premium' then 200 else 0 end;
    period:='paid:'||extract(epoch from account.period_start)::text; cadence:=interval '7 days'; ceiling:=capacity*5;
  else return jsonb_build_object('allowed',false,'reason','payment_required');
  end if;
  select ordinal into target_position from (
    select t.id,row_number() over(order by t.created_at,t.id) ordinal from public.tracked_keywords t join public.websites w on w.id=t.website_id join public.organizations o on o.id=w.organization_id where o.owner_id=owner and t.status<>'paused'
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
