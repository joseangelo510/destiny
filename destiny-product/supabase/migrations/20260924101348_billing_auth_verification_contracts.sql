-- Auth verification is established by trusted Edge callers through Auth Admin.
-- These invoker functions keep the database contract service-only without granting
-- service_role broad SELECT access to Supabase's managed auth.users table.
create function public.begin_billed_audit_v2(
  p_website_id uuid,
  p_user_id uuid,
  p_provider text,
  p_livemode boolean,
  p_actor_verified boolean,
  p_owner_verified boolean
)
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
  if p_actor_verified is distinct from true or p_owner_verified is distinct from true
    then return jsonb_build_object('allowed',false,'reason','verification_required'); end if;
  insert into public.billing_accounts(owner_id,livemode) values(owner,p_livemode) on conflict(owner_id) do nothing;
  select * into account from public.billing_accounts where owner_id=owner for update;
  if account.livemode<>p_livemode then raise exception 'Billing mode mismatch'; end if;
  select id into running_id from public.audits where website_id=p_website_id and status='running'
    and updated_at>=now()-interval '3 minutes' order by started_at desc limit 1;
  if running_id is not null then return jsonb_build_object('allowed',true,'created',false,'auditId',running_id); end if;
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
  if not coalesce((started->>'created')::boolean,false) then
    raise exception 'Audit start raced another worker; retry current audit';
  end if;
  return started||jsonb_build_object('allowed',true,'usageId',receipt,'free',free_grant);
end;
$$;
revoke all on function public.begin_billed_audit_v2(uuid,uuid,text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.begin_billed_audit_v2(uuid,uuid,text,boolean,boolean,boolean) to service_role;

create function public.reserve_competitor_suggestions_v2(p_owner_id uuid,p_livemode boolean,p_owner_verified boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  receipt uuid:=gen_random_uuid();
begin
  if p_livemode is null then raise exception 'Billing mode required'; end if;
  if p_owner_verified is distinct from true
    then return jsonb_build_object('allowed',false,'reason','verification_required'); end if;
  insert into public.billing_accounts(owner_id,livemode) values(p_owner_id,p_livemode) on conflict(owner_id) do nothing;
  select * into account from public.billing_accounts where owner_id=p_owner_id for update;
  if account.livemode<>p_livemode then raise exception 'Billing mode mismatch'; end if;
  if account.free_audit_claimed_at is null
    and not exists(select 1 from public.audits a join public.websites w on w.id=a.website_id
      join public.organizations o on o.id=w.organization_id where o.owner_id=p_owner_id)
    and (select count(*) from public.billing_usage where owner_id=p_owner_id and period_key='onboarding-research')<2 then
    insert into public.billing_usage(id,owner_id,request_key,meter,period_key,units)
      values(receipt,p_owner_id,'onboarding-search:'||receipt::text,'keywordSearches','onboarding-research',1);
    return jsonb_build_object('allowed',true,'id',receipt);
  end if;
  return public.reserve_billing_usage(p_owner_id,null,'competitor-search:'||receipt::text,'keywordSearches',1);
end;
$$;
revoke all on function public.reserve_competitor_suggestions_v2(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.reserve_competitor_suggestions_v2(uuid,boolean,boolean) to service_role;

create function public.reserve_transactional_email_v2(
  p_actor_id uuid,
  p_website_id uuid,
  p_kind text,
  p_request_key uuid,
  p_actor_verified boolean
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid; used bigint; receipt uuid;
begin
  if p_kind is null or p_kind not in ('welcome','progress') or p_request_key is null then raise exception 'Invalid email request'; end if;
  if p_actor_verified is distinct from true
    then return jsonb_build_object('allowed',false,'reason','verification_required'); end if;
  select o.owner_id into owner from public.websites w join public.organizations o on o.id=w.organization_id
    where w.id=p_website_id and (o.owner_id=p_actor_id or exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=p_actor_id));
  if owner is null then return jsonb_build_object('allowed',false,'reason','website_unavailable'); end if;
  perform id from public.profiles where id=owner for no key update;
  if exists(select 1 from public.billing_email_attempts where owner_id=owner and kind=p_kind and request_key=p_request_key)
    then return jsonb_build_object('allowed',false,'reason','duplicate'); end if;
  select count(*) into used from public.billing_email_attempts where owner_id=owner and kind=p_kind
    and (p_kind='welcome' or created_at>now()-interval '24 hours');
  if used>=(case when p_kind='welcome' then 2 else 5 end)
    then return jsonb_build_object('allowed',false,'reason','limit_reached'); end if;
  insert into public.billing_email_attempts(owner_id,website_id,kind,request_key) values(owner,p_website_id,p_kind,p_request_key) returning id into receipt;
  return jsonb_build_object('allowed',true,'id',receipt);
end;
$$;
revoke all on function public.reserve_transactional_email_v2(uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_transactional_email_v2(uuid,uuid,text,uuid,boolean) to service_role;
