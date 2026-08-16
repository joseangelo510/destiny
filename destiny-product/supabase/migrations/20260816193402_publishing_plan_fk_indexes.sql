create index publishing_plans_audit_idx on public.publishing_plans (audit_id);
create index publishing_plans_created_by_idx on public.publishing_plans (created_by);
create index publishing_plans_organization_idx on public.publishing_plans (organization_id);
create index publishing_schedule_audit_idx on public.publishing_schedule_items (audit_id);
create index publishing_schedule_organization_idx on public.publishing_schedule_items (organization_id);
