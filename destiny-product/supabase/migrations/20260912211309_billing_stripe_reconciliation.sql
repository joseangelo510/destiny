-- Save the current Stripe snapshot and its receipt in the same transaction.
-- The webhook worker obtains its account lease BEFORE reading Stripe.
create function public.apply_billing_snapshot(
  p_owner_id uuid,p_token uuid,p_event_id text,p_event_type text,p_livemode boolean,p_snapshot jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  first_trial timestamptz;
begin
  select * into account from public.billing_accounts where owner_id=p_owner_id for update;
  if not found or p_token is null or account.operation_expires_at is null or account.operation_token is distinct from p_token or account.operation_expires_at <= now() then raise exception 'Billing operation expired'; end if;
  if account.livemode is distinct from p_livemode or account.stripe_customer_id is distinct from p_snapshot->>'customer' then raise exception 'Stripe account mismatch'; end if;
  if exists(select 1 from public.billing_stripe_events where event_id=p_event_id and processed_at is not null) then return false; end if;
  if p_snapshot->>'plan' not in ('starter','growth','premium') or p_snapshot->>'plan' is null then raise exception 'Unknown subscription plan'; end if;
  if p_snapshot->>'status' not in ('active','trialing','canceled','past_due','unpaid','paused','incomplete','incomplete_expired') or p_snapshot->>'status' is null then raise exception 'Unknown subscription state'; end if;
  if p_snapshot->>'id' is null or p_event_id is null or p_event_type is null then raise exception 'Subscription receipt required'; end if;
  first_trial := coalesce(account.trial_started_at,(p_snapshot->>'trialStart')::timestamptz);
  if p_snapshot->>'status'='trialing' and (first_trial is null or p_snapshot->>'trialEnd' is null) then raise exception 'Trial timestamps required'; end if;
  update public.billing_accounts set
    stripe_subscription_id=p_snapshot->>'id',plan=p_snapshot->>'plan',status=p_snapshot->>'status',
    period_start=(p_snapshot->>'periodStart')::timestamptz,period_end=(p_snapshot->>'periodEnd')::timestamptz,
    paid_through=(p_snapshot->>'paidThrough')::timestamptz,trial_started_at=first_trial,
    trial_end=case when p_snapshot->>'trialEnd' is null then null else least((p_snapshot->>'trialEnd')::timestamptz,first_trial+interval '7 days') end,
    cancel_at_period_end=coalesce((p_snapshot->>'cancelAtPeriodEnd')::boolean,false),updated_at=now()
    where owner_id=p_owner_id;
  insert into public.billing_stripe_events(event_id,event_type,livemode,stripe_customer_id,processed_at)
    values(p_event_id,p_event_type,p_livemode,account.stripe_customer_id,now())
    on conflict(event_id) do update set processed_at=excluded.processed_at,error_code=null;
  return true;
end;
$$;
revoke all on function public.apply_billing_snapshot(uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.apply_billing_snapshot(uuid,uuid,text,text,boolean,jsonb) to service_role;
