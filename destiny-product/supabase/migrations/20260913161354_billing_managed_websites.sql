-- Selecting a managed website never deletes the saved website or its history.
create table public.billing_managed_websites (
  website_id uuid primary key references public.websites(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  selected_at timestamptz not null default now()
);
create index billing_managed_websites_owner_idx on public.billing_managed_websites(owner_id);
alter table public.billing_managed_websites enable row level security;
revoke all on public.billing_managed_websites from public,anon,authenticated;
grant select on public.billing_managed_websites to authenticated;
grant all on public.billing_managed_websites to service_role;
create policy billing_managed_websites_owner_read on public.billing_managed_websites
  for select to authenticated using(owner_id=(select auth.uid()));

create function public.billing_website_capacity(p_owner_id uuid)
returns integer language sql stable security invoker set search_path='' as $$
  select coalesce((select case
    when a.status='active' and a.period_start<=now() and a.period_end>now() and a.paid_through>now()
      then case a.plan when 'starter' then 1 when 'growth' then 3 when 'premium' then 10 else 1 end
    else 1 end from public.billing_accounts a where a.owner_id=p_owner_id),1);
$$;
revoke all on function public.billing_website_capacity(uuid) from public,anon,authenticated;
grant execute on function public.billing_website_capacity(uuid) to service_role;

create function public.billing_website_selection(p_owner_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'capacity',public.billing_website_capacity(p_owner_id),
    'selected',coalesce((select jsonb_agg(s.website_id order by s.website_id) from public.billing_managed_websites s
      join public.websites w on w.id=s.website_id join public.organizations o on o.id=w.organization_id
      where s.owner_id=p_owner_id and o.owner_id=p_owner_id),'[]'::jsonb),
    'websites',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.business_name,'domain',w.normalized_domain) order by w.normalized_domain,w.id)
      from public.websites w join public.organizations o on o.id=w.organization_id where o.owner_id=p_owner_id),'[]'::jsonb)
  );
$$;
revoke all on function public.billing_website_selection(uuid) from public,anon,authenticated;
grant execute on function public.billing_website_selection(uuid) to service_role;

create function public.set_billing_websites(p_actor_id uuid,p_website_ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare capacity integer;
begin
  if p_actor_id is null or p_website_ids is null or cardinality(p_website_ids)>10
    or exists(select 1 from unnest(p_website_ids) id where id is null)
    or cardinality(p_website_ids)<>(select count(distinct id) from unnest(p_website_ids) id)
    then raise exception 'Invalid website selection'; end if;
  -- Serialize first selections even before an owner has a billing account.
  perform id from public.profiles where id=p_actor_id for no key update;
  if not found then raise exception 'Account unavailable'; end if;
  perform owner_id from public.billing_accounts where owner_id=p_actor_id for update;
  capacity:=public.billing_website_capacity(p_actor_id);
  if cardinality(p_website_ids)>capacity then raise exception 'Managed website limit exceeded'; end if;
  if cardinality(p_website_ids)<>(select count(*) from public.websites w join public.organizations o on o.id=w.organization_id
    where w.id=any(p_website_ids) and o.owner_id=p_actor_id) then raise exception 'Website ownership required'; end if;
  delete from public.billing_managed_websites where owner_id=p_actor_id and not(website_id=any(p_website_ids));
  insert into public.billing_managed_websites(owner_id,website_id) select p_actor_id,id from unnest(p_website_ids) id
    on conflict(website_id) do update set owner_id=excluded.owner_id;
  return public.billing_website_selection(p_actor_id);
end;
$$;
revoke all on function public.set_billing_websites(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.set_billing_websites(uuid,uuid[]) to service_role;

create function public.is_billing_website_managed(p_owner_id uuid,p_website_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.billing_managed_websites s join public.websites w on w.id=s.website_id
    join public.organizations o on o.id=w.organization_id
    where s.owner_id=p_owner_id and s.website_id=p_website_id and o.owner_id=p_owner_id)
    and (select count(*) from public.billing_managed_websites where owner_id=p_owner_id)<=public.billing_website_capacity(p_owner_id);
$$;
revoke all on function public.is_billing_website_managed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.is_billing_website_managed(uuid,uuid) to service_role;
