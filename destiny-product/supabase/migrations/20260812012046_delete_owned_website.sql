-- A website owner can remove one website without deleting their Destiny account.
-- Every website-owned child table uses ON DELETE CASCADE, so this single delete
-- remains atomic and cannot leave audit, content, rank-tracking, or integration
-- rows behind.
grant delete on public.websites to authenticated;

create policy "websites_delete_owners" on public.websites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organizations organization
      where organization.id = websites.organization_id
        and organization.owner_id = (select auth.uid())
    )
  );
