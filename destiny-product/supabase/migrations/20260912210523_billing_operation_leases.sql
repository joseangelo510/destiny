-- Serialize remote payment operations without holding a DB transaction over HTTP.
-- The token must also match when persisting remote results; expired workers lose write authority.
alter table public.billing_accounts add column operation_token uuid;
alter table public.billing_accounts add column operation_expires_at timestamptz;

create function public.claim_billing_operation(p_owner_id uuid,p_livemode boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  token uuid := gen_random_uuid();
begin
  if p_owner_id is null or p_livemode is null then raise exception 'Billing owner and mode required'; end if;
  insert into public.billing_accounts(owner_id,livemode) values(p_owner_id,p_livemode) on conflict(owner_id) do nothing;
  select * into account from public.billing_accounts where owner_id=p_owner_id for update;
  if account.livemode <> p_livemode then raise exception 'Billing mode mismatch'; end if;
  if account.operation_expires_at > now() then return jsonb_build_object('acquired',false); end if;
  update public.billing_accounts set operation_token=token,operation_expires_at=now()+interval '2 minutes' where owner_id=p_owner_id;
  return jsonb_build_object('acquired',true,'token',token);
end;
$$;
revoke all on function public.claim_billing_operation(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_billing_operation(uuid,boolean) to service_role;

create function public.release_billing_operation(p_owner_id uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.billing_accounts set operation_token=null,operation_expires_at=null where owner_id=p_owner_id and operation_token=p_token;
  return found;
end;
$$;
revoke all on function public.release_billing_operation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.release_billing_operation(uuid,uuid) to service_role;
