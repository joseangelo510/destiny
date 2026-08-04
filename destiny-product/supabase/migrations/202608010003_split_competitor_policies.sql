-- Keep competitor read and write policies distinct so SELECT is evaluated once.
drop policy "competitors_write_members" on public.competitors;

create policy "competitors_insert_members" on public.competitors
  for insert to authenticated with check (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and private.is_organization_member(website.organization_id))
  );

create policy "competitors_update_members" on public.competitors
  for update to authenticated using (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and private.is_organization_member(website.organization_id))
  ) with check (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and private.is_organization_member(website.organization_id))
  );

create policy "competitors_delete_members" on public.competitors
  for delete to authenticated using (
    exists (select 1 from public.websites website
      where website.id = competitors.website_id
        and private.is_organization_member(website.organization_id))
  );
