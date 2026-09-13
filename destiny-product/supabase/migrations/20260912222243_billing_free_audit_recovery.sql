-- One bounded same-site retry after a confirmed initial-audit failure.
create or replace function public.begin_billed_audit(p_website_id uuid,p_user_id uuid,p_provider text,p_livemode boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid;
  account public.billing_accounts%rowtype;
  running_id uuid;
  receipt uuid;
  reservation jsonb;
  started jsonb;
  free_grant boolean:=false;
begin
  if p_livemode is null then raise exception 'Billing mode required'; end if;
  select o.owner_id into owner from public.websites w join public.organizations o on o.id=w.organization_id
    join public.organization_members m on m.organization_id=o.id and m.user_id=p_user_id
    where w.id=p_website_id;
  if owner is null then return jsonb_build_object('allowed',false,'reason','website_unavailable'); end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null)
    or not exists(select 1 from auth.users where id=owner and email_confirmed_at is not null)
    then return jsonb_build_object('allowed',false,'reason','verification_required'); end if;
  insert into public.billing_accounts(owner_id,livemode) values(owner,p_livemode) on conflict(owner_id) do nothing;
  select * into account from public.billing_accounts where owner_id=owner for update;
  if account.livemode<>p_livemode then raise exception 'Billing mode mismatch'; end if;
  select id into running_id from public.audits where website_id=p_website_id and status='running'
    and updated_at>=now()-interval '3 minutes' order by started_at desc limit 1;
  if running_id is not null then return jsonb_build_object('allowed',true,'created',false,'auditId',running_id); end if;
  -- Prior audit history means this is a rerun, not a new-user initial grant.
  if account.free_audit_claimed_at is null and exists(
    select 1 from public.audits a join public.websites w on w.id=a.website_id
      join public.organizations o on o.id=w.organization_id where o.owner_id=owner
  ) then
    update public.billing_accounts set free_audit_claimed_at=now() where owner_id=owner;
    account.free_audit_claimed_at:=now();
  end if;
  if account.free_audit_claimed_at is null or (
    account.free_audit_claimed_at>now()-interval '7 days'
    and (select count(*) from public.billing_usage where owner_id=owner and period_key='initial-audit' and meter='audits')=1
    and exists(select 1 from public.billing_usage where owner_id=owner and period_key='initial-audit'
      and meter='audits' and state='failed' and website_id=p_website_id)
  ) then
    free_grant:=true;
    receipt:=gen_random_uuid();
    update public.billing_accounts set free_audit_claimed_at=coalesce(free_audit_claimed_at,now()) where owner_id=owner;
    insert into public.billing_usage(id,owner_id,website_id,request_key,meter,period_key,units)
      values(receipt,owner,p_website_id,'initial-audit:'||receipt::text,'audits','initial-audit',1);
  else
    reservation:=public.reserve_billing_usage(owner,p_website_id,'audit:'||gen_random_uuid()::text,'audits',1);
    if not coalesce((reservation->>'allowed')::boolean,false) then return reservation; end if;
    receipt:=(reservation->>'id')::uuid;
  end if;
  started:=public.begin_destiny_audit_v2(p_website_id,p_user_id,p_provider);
  -- The owner lock serializes this path; guard against an older worker racing it.
  if not coalesce((started->>'created')::boolean,false) then
    raise exception 'Audit start raced another worker; retry current audit';
  end if;
  return started||jsonb_build_object('allowed',true,'usageId',receipt,'free',free_grant);
end;
$$;
revoke all on function public.begin_billed_audit(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.begin_billed_audit(uuid,uuid,text,boolean) to service_role;
