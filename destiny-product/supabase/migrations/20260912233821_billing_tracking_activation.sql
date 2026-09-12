-- Private trigger: enforce activation across API routes and direct authenticated writes.
-- This internal lookup needs owner billing visibility, but never returns billing data.
create or replace function private.enforce_tracking_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  organization uuid;
  owner uuid;
  account public.billing_accounts%rowtype;
  capacity integer := 0;
  used bigint;
begin
  if new.status = 'paused' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'paused' and old.website_id = new.website_id
      and old.normalized_keyword = new.normalized_keyword
      and old.location_code = new.location_code and old.language_code = new.language_code
      and old.device = new.device then return new; end if;
  end if;
  select w.organization_id,o.owner_id into organization,owner
    from public.websites w join public.organizations o on o.id=w.organization_id
    where w.id=new.website_id;
  if owner is null then raise exception 'Website not available.' using errcode='42501'; end if;
  if viewer is not null then
    if not exists(select 1 from public.organization_members m where m.organization_id=organization and m.user_id=viewer) then
      raise exception 'Website not available.' using errcode='42501';
    end if;
  elsif coalesce(current_setting('role',true),'') not in ('service_role','none') then
    raise exception 'Sign in again to continue.' using errcode='42501';
  end if;
  select * into account from public.billing_accounts where owner_id=owner for update;
  if found then
    if account.status='trialing' and account.plan is not null and account.period_start<=now()
      and account.trial_started_at<=now() and account.trial_end>now() then capacity:=10;
    elsif account.status='active' and account.period_start<=now() and account.period_end>now() and account.paid_through>now() then
      capacity:=case account.plan when 'starter' then 25 when 'growth' then 75 when 'premium' then 200 else 0 end;
    end if;
  end if;
  if capacity=0 then
    new.status:='paused'; new.last_error:='Tracking paused: an active subscription or trial is required.';
    return new;
  end if;
  select count(*) into used from public.tracked_keywords t
    join public.websites w on w.id=t.website_id join public.organizations o on o.id=w.organization_id
    where o.owner_id=owner and t.status<>'paused' and t.id<>new.id
      and not (t.website_id=new.website_id and t.normalized_keyword=new.normalized_keyword
        and t.location_code=new.location_code and t.language_code=new.language_code and t.device=new.device);
  if used>=capacity then
    new.status:='paused'; new.last_error:='Tracking paused: the account tracking limit has been reached. Pause another keyword or review your plan.';
  else
    new.last_error:=null;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_tracking_capacity() from public,anon,authenticated;
create trigger tracked_keywords_billing_capacity before insert or update on public.tracked_keywords
  for each row execute function private.enforce_tracking_capacity();
