-- Bound automatic suggestions before a website exists. Manual input is unmetered.
create function public.reserve_competitor_suggestions(p_owner_id uuid,p_livemode boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  receipt uuid:=gen_random_uuid();
begin
  if p_livemode is null then raise exception 'Billing mode required'; end if;
  if not exists(select 1 from auth.users where id=p_owner_id and email_confirmed_at is not null)
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
revoke all on function public.reserve_competitor_suggestions(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_competitor_suggestions(uuid,boolean) to service_role;
