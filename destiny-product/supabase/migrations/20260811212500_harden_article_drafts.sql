create index if not exists article_drafts_audit_idx on public.article_drafts (audit_id);
create index if not exists article_drafts_organization_idx on public.article_drafts (organization_id);
create index if not exists article_drafts_user_idx on public.article_drafts (user_id);

drop policy if exists "article_drafts_select_members" on public.article_drafts;
create policy "article_drafts_select_members" on public.article_drafts
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );

drop policy if exists "article_drafts_insert_members" on public.article_drafts;
create policy "article_drafts_insert_members" on public.article_drafts
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );

drop policy if exists "article_drafts_update_members" on public.article_drafts;
create policy "article_drafts_update_members" on public.article_drafts
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites website
      join public.audits audit on audit.website_id = website.id
      where website.id = article_drafts.website_id
        and website.organization_id = article_drafts.organization_id
        and audit.id = article_drafts.audit_id
    )
  );
