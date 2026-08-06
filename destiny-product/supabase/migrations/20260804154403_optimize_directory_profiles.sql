create index directory_profiles_organization_idx
  on public.directory_profiles (organization_id);

drop policy "directory_profiles_write_members" on public.directory_profiles;

create policy "directory_profiles_insert_members" on public.directory_profiles
  for insert to authenticated
  with check (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = directory_profiles.website_id
        and website.organization_id = directory_profiles.organization_id
    )
  );

create policy "directory_profiles_update_members" on public.directory_profiles
  for update to authenticated
  using (private.is_organization_member(organization_id))
  with check (
    private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = directory_profiles.website_id
        and website.organization_id = directory_profiles.organization_id
    )
  );

create policy "directory_profiles_delete_members" on public.directory_profiles
  for delete to authenticated
  using (private.is_organization_member(organization_id));
