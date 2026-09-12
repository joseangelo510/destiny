-- Additive billing storage. No existing customer is enrolled, charged or deleted.
-- Only trusted server workers may mutate money, entitlement and usage state.
create table public.billing_accounts (
  owner_id uuid primary key references public.profiles(id) on delete restrict,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text check (plan in ('starter','growth','premium')),
  status text not null default 'none',
  period_start timestamptz,
  period_end timestamptz,
  paid_through timestamptz,
  trial_started_at timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
revoke all on public.billing_accounts from anon, authenticated;
grant select on public.billing_accounts to authenticated;
grant all on public.billing_accounts to service_role;
create policy billing_accounts_owner_read on public.billing_accounts
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.billing_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.billing_accounts(owner_id) on delete restrict,
  website_id uuid references public.websites(id) on delete set null,
  request_key text not null check (length(request_key) between 8 and 200),
  meter text not null check (meter in ('articles','keywordSearches','domainReports','shortOutputs','audits','infographics')),
  period_key text not null,
  units integer not null check (units > 0),
  state text not null default 'reserved' check (state in ('reserved','completed','failed')),
  provider_cost_usd numeric(12,6) check (provider_cost_usd >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(owner_id, request_key)
);
create index billing_usage_period_idx on public.billing_usage(owner_id,period_key,meter,state);
create index billing_usage_website_idx on public.billing_usage(website_id);
alter table public.billing_usage enable row level security;
revoke all on public.billing_usage from anon, authenticated;
grant select on public.billing_usage to authenticated;
grant all on public.billing_usage to service_role;
create policy billing_usage_owner_read on public.billing_usage
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.billing_stripe_events (
  event_id text primary key,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  event_type text not null,
  livemode boolean not null,
  stripe_customer_id text,
  error_code text
);
alter table public.billing_stripe_events enable row level security;
revoke all on public.billing_stripe_events from anon, authenticated;
grant all on public.billing_stripe_events to service_role;

-- This is an internal RPC: SECURITY INVOKER, unavailable to browser roles.
-- An account row lock serializes the final unit across sites and workers.
create function public.reserve_billing_usage(
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

create function public.finish_billing_usage(p_id uuid,p_succeeded boolean,p_provider_cost_usd numeric default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_succeeded is null or p_provider_cost_usd < 0 then raise exception 'Invalid usage outcome'; end if;
  update public.billing_usage set state=case when p_succeeded then 'completed' else 'failed' end,
    provider_cost_usd=p_provider_cost_usd,finished_at=now()
    where id=p_id and state='reserved';
end;
$$;
revoke all on function public.finish_billing_usage(uuid,boolean,numeric) from public, anon, authenticated;
grant execute on function public.finish_billing_usage(uuid,boolean,numeric) to service_role;

-- Aggregate on the database so large accounts cannot undercount at the REST row limit.
create function public.billing_period_usage()
returns table(meter text, used bigint) language sql stable security invoker set search_path = '' as $$
  select u.meter, sum(u.units)::bigint
  from public.billing_usage u join public.billing_accounts a on a.owner_id=u.owner_id
  where a.owner_id=(select auth.uid()) and u.state in ('reserved','completed')
    and u.period_key=case when a.status='trialing' then 'trial:' || extract(epoch from a.trial_started_at)::text else 'paid:' || extract(epoch from a.period_start)::text end
  group by u.meter;
$$;
revoke all on function public.billing_period_usage() from public, anon;
grant execute on function public.billing_period_usage() to authenticated, service_role;
