-- Require selection only for new website-scoped paid receipts; preserve in-flight settlement.
create or replace function public.reserve_billing_usage(
  p_owner_id uuid, p_website_id uuid, p_request_key text, p_meter text, p_units integer default 1
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  existing public.billing_usage%rowtype;
  limits jsonb;
  v_period_key text;
  allowance integer;
  consumed bigint;
  reservation_id uuid;
begin
  if p_units is null or p_units < 1 or p_units > 10000 or p_request_key is null or length(p_request_key) not between 8 and 200 then
    raise exception 'Invalid billing reservation';
  end if;
  select * into account from public.billing_accounts where owner_id = p_owner_id for update;
  if not found then return jsonb_build_object('allowed',false,'reason','choose_plan'); end if;
  if p_website_id is not null and not exists (
    select 1 from public.websites w join public.organizations o on o.id=w.organization_id
    where w.id=p_website_id and o.owner_id=p_owner_id
  ) then raise exception 'Website owner mismatch'; end if;
  select * into existing from public.billing_usage where owner_id=p_owner_id and request_key=p_request_key;
  if found then
    if existing.meter <> p_meter or existing.units <> p_units or existing.website_id is distinct from p_website_id then
      raise exception 'Idempotency key reused for a different operation';
    end if;
    return jsonb_build_object('allowed',false,'reason','duplicate','id',existing.id,'state',existing.state);
  end if;
  if account.status='trialing' and account.plan is not null and account.period_start <= now() and account.trial_end > now() then
    limits := '{"articles":2,"keywordSearches":10,"domainReports":1,"shortOutputs":2,"audits":0,"infographics":0}'::jsonb;
    v_period_key := 'trial:' || extract(epoch from account.trial_started_at)::text;
  elsif account.status='active' and account.period_start <= now() and account.period_end > now() and account.paid_through > now() then
    limits := case account.plan
      when 'starter' then '{"articles":4,"keywordSearches":50,"domainReports":3,"shortOutputs":4,"audits":1,"infographics":0}'::jsonb
      when 'growth' then '{"articles":12,"keywordSearches":150,"domainReports":10,"shortOutputs":12,"audits":3,"infographics":2}'::jsonb
      when 'premium' then '{"articles":40,"keywordSearches":400,"domainReports":25,"shortOutputs":30,"audits":10,"infographics":5}'::jsonb
      else null end;
    v_period_key := 'paid:' || extract(epoch from account.period_start)::text;
  else return jsonb_build_object('allowed',false,'reason','payment_required');
  end if;
  if p_website_id is not null and not public.is_billing_website_managed(p_owner_id,p_website_id) then
    return jsonb_build_object('allowed',false,'reason','managed_website_required');
  end if;
  allowance := (limits ->> p_meter)::integer;
  if allowance is null or v_period_key is null then raise exception 'Unknown billing meter or period'; end if;
  select coalesce(sum(u.units),0) into consumed from public.billing_usage u
    where u.owner_id=p_owner_id and u.period_key=v_period_key and u.meter=p_meter and u.state in ('reserved','completed');
  if consumed+p_units > allowance then return jsonb_build_object('allowed',false,'reason','limit_reached','limit',allowance,'used',consumed); end if;
  insert into public.billing_usage(owner_id,website_id,request_key,meter,period_key,units)
    values(p_owner_id,p_website_id,p_request_key,p_meter,v_period_key,p_units) returning id into reservation_id;
  return jsonb_build_object('allowed',true,'id',reservation_id,'remaining',allowance-consumed-p_units);
end;
$$;
revoke all on function public.reserve_billing_usage(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_billing_usage(uuid,uuid,text,text,integer) to service_role;
