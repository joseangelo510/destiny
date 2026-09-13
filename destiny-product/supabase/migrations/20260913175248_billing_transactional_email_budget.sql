-- Count attempted provider sends, including uncertain outcomes; deleting sites must not reset spend.
create table public.billing_email_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  website_id uuid references public.websites(id) on delete set null,
  kind text not null check(kind in ('welcome','progress')),
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique(owner_id,kind,request_key)
);
create index billing_email_attempts_budget_idx on public.billing_email_attempts(owner_id,kind,created_at);
alter table public.billing_email_attempts enable row level security;
revoke all on public.billing_email_attempts from public,anon,authenticated;
grant all on public.billing_email_attempts to service_role;
create function public.reserve_transactional_email(p_actor_id uuid,p_website_id uuid,p_kind text,p_request_key uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid; used bigint; receipt uuid;
begin
  if p_kind is null or p_kind not in ('welcome','progress') or p_request_key is null then raise exception 'Invalid email request'; end if;
  if not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
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
revoke all on function public.reserve_transactional_email(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_transactional_email(uuid,uuid,text,uuid) to service_role;
