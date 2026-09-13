-- Bound substeps share the parent allowance without permitting replayed provider work.
alter table public.billing_usage add column artifact_hash text check (artifact_hash ~ '^[a-f0-9]{64}$');
alter table public.billing_usage add column stage_claims jsonb not null default '{}'::jsonb;

create function public.bind_billing_artifact(p_owner_id uuid,p_id uuid,p_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
declare usage public.billing_usage%rowtype;
begin
  select * into usage from public.billing_usage where id=p_id and owner_id=p_owner_id for update;
  if not found or usage.state<>'reserved' or usage.meter<>'infographics' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Artifact reservation unavailable'; end if;
  if usage.artifact_hash is not null and usage.artifact_hash<>p_hash then raise exception 'Artifact already bound'; end if;
  update public.billing_usage set artifact_hash=p_hash where id=p_id;
end;
$$;

create function public.claim_billing_stage(p_owner_id uuid,p_id uuid,p_stage text,p_artifact_hash text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  account public.billing_accounts%rowtype;
  usage public.billing_usage%rowtype;
begin
  -- Same account-before-usage lock order as reservations and payment reconciliation.
  select * into account from public.billing_accounts where owner_id=p_owner_id for update;
  if not found then return false; end if;
  if not coalesce((account.status='active' and account.period_start<=now() and account.period_end>now() and account.paid_through>now()) or (account.status='trialing' and account.period_start<=now() and account.trial_started_at<=now() and account.trial_end>now()),false) then return false; end if;
  select * into usage from public.billing_usage where id=p_id and owner_id=p_owner_id for update;
  if not found or usage.state<>'reserved' or usage.stage_claims ? p_stage then return false; end if;
  if p_stage='article_evidence' then
    if usage.meter<>'articles' or usage.created_at<now()-interval '15 minutes' then return false; end if;
  elsif p_stage='infographic_render' then
    if usage.meter<>'infographics' or account.status<>'active' or account.plan not in ('growth','premium') or usage.period_key is distinct from ('paid:'||extract(epoch from account.period_start)::text) or usage.artifact_hash is null or usage.artifact_hash is distinct from p_artifact_hash then return false; end if;
  else return false;
  end if;
  update public.billing_usage set stage_claims=stage_claims||jsonb_build_object(p_stage,now()) where id=p_id;
  return true;
end;
$$;
revoke all on function public.bind_billing_artifact(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_billing_stage(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bind_billing_artifact(uuid,uuid,text) to service_role;
grant execute on function public.claim_billing_stage(uuid,uuid,text,text) to service_role;
