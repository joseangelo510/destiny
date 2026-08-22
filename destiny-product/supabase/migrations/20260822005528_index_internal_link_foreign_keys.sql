create index if not exists interlink_opportunities_organization_idx
  on public.interlink_opportunities (organization_id);

create index if not exists interlink_runs_audit_idx
  on public.interlink_runs (audit_id);

create index if not exists interlink_runs_organization_idx
  on public.interlink_runs (organization_id);

create index if not exists interlink_runs_user_idx
  on public.interlink_runs (user_id);
