-- Keep website and audit references in the same organization for the newest
-- website-scoped features. RLS is the write boundary; the QA audit separately
-- detects any privileged or legacy row that violates the invariant.

drop policy if exists "interviews_select_members" on public.interviews;
create policy "interviews_select_members" on public.interviews
  for select to authenticated using (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = interviews.website_id
        and website.organization_id = interviews.organization_id
    )
    and (
      interviews.audit_id is null or exists (
        select 1 from public.audits audit
        where audit.id = interviews.audit_id
          and audit.website_id = interviews.website_id
      )
    )
  );

drop policy if exists "interviews_insert_members" on public.interviews;
create policy "interviews_insert_members" on public.interviews
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = interviews.website_id
        and website.organization_id = interviews.organization_id
    )
    and (
      interviews.audit_id is null or exists (
        select 1 from public.audits audit
        where audit.id = interviews.audit_id
          and audit.website_id = interviews.website_id
      )
    )
  );

drop policy if exists "interviews_update_members" on public.interviews;
create policy "interviews_update_members" on public.interviews
  for update to authenticated using (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = interviews.website_id
        and website.organization_id = interviews.organization_id
    )
  ) with check (
    created_by = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = interviews.website_id
        and website.organization_id = interviews.organization_id
    )
    and (
      interviews.audit_id is null or exists (
        select 1 from public.audits audit
        where audit.id = interviews.audit_id
          and audit.website_id = interviews.website_id
      )
    )
  );

drop policy if exists "interviews_delete_members" on public.interviews;
create policy "interviews_delete_members" on public.interviews
  for delete to authenticated using (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = interviews.website_id
        and website.organization_id = interviews.organization_id
    )
  );

drop policy if exists "interlink_runs_select_members" on public.interlink_runs;
create policy "interlink_runs_select_members" on public.interlink_runs
  for select to authenticated using (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = interlink_runs.website_id
        and website.organization_id = interlink_runs.organization_id
        and audit.id = interlink_runs.audit_id
    )
  );

drop policy if exists "interlink_runs_insert_members" on public.interlink_runs;
create policy "interlink_runs_insert_members" on public.interlink_runs
  for insert to authenticated with check (
    private.is_organization_member(organization_id)
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = interlink_runs.website_id
        and website.organization_id = interlink_runs.organization_id
        and audit.id = interlink_runs.audit_id
    )
  );

drop policy if exists "interlink_runs_update_owners" on public.interlink_runs;
create policy "interlink_runs_update_owners" on public.interlink_runs
  for update to authenticated using (
    private.is_organization_member(organization_id)
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = interlink_runs.website_id
        and website.organization_id = interlink_runs.organization_id
        and audit.id = interlink_runs.audit_id
    )
  ) with check (
    private.is_organization_member(organization_id)
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = interlink_runs.website_id
        and website.organization_id = interlink_runs.organization_id
        and audit.id = interlink_runs.audit_id
    )
  );
