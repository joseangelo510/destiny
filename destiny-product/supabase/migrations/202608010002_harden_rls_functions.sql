-- Keep policy helpers and trigger functions out of the exposed public API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

revoke all on function public.is_organization_member(uuid) from public, anon, authenticated;
revoke all on function public.has_organization_role(uuid, text[]) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter function public.is_organization_member(uuid) set schema private;
alter function public.has_organization_role(uuid, text[]) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.touch_updated_at() set schema private;

grant usage on schema private to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated;

-- This is the one intentional public RPC. It validates auth.uid() internally.
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- Cover every foreign key used for joins, cascading deletes, and policy checks.
create index organizations_owner_idx on public.organizations (owner_id);
create index organization_members_user_idx on public.organization_members (user_id);
create index competitors_website_idx on public.competitors (website_id);
create index audits_requested_by_idx on public.audits (requested_by);
create index quests_audit_idx on public.quests (audit_id);
create index notifications_organization_idx on public.notifications (organization_id);
create index integrations_website_idx on public.integrations (website_id) where website_id is not null;

-- Cache auth.uid() once per statement and scope policies to signed-in users.
drop policy "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "audits_insert_members" on public.audits;
create policy "audits_insert_members" on public.audits
  for insert to authenticated with check (
    requested_by = (select auth.uid()) and
    exists (select 1 from public.websites website
      where website.id = audits.website_id
        and private.is_organization_member(website.organization_id))
  );

drop policy "notifications_select_self" on public.notifications;
create policy "notifications_select_self" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A single policy per action avoids redundant evaluation while preserving the
-- rule that admins cannot grant, modify, or remove the owner role.
drop policy "members_insert_owners" on public.organization_members;
drop policy "members_insert_admins" on public.organization_members;
create policy "members_insert_admins" on public.organization_members
  for insert to authenticated with check (
    private.has_organization_role(organization_id, array['owner']) or
    (role in ('admin', 'member') and private.has_organization_role(organization_id, array['admin']))
  );

drop policy "members_update_owners" on public.organization_members;
drop policy "members_update_admins" on public.organization_members;
create policy "members_update_admins" on public.organization_members
  for update to authenticated using (
    private.has_organization_role(organization_id, array['owner']) or
    (role <> 'owner' and private.has_organization_role(organization_id, array['admin']))
  ) with check (
    private.has_organization_role(organization_id, array['owner']) or
    (role in ('admin', 'member') and private.has_organization_role(organization_id, array['admin']))
  );

drop policy "members_delete_owners" on public.organization_members;
drop policy "members_delete_admins" on public.organization_members;
create policy "members_delete_admins" on public.organization_members
  for delete to authenticated using (
    private.has_organization_role(organization_id, array['owner']) or
    (role <> 'owner' and private.has_organization_role(organization_id, array['admin']))
  );

-- OAuth integration writes are server-only; browser members have read access.
drop policy "integrations_write_admins" on public.integrations;
