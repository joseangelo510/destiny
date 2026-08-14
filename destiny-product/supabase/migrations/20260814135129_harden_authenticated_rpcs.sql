-- Keep privileged implementations out of the exposed public API while
-- preserving the existing RPC names used by the application.

alter function public.create_organization(text) set schema private;

create or replace function private.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization uuid;
  normalized_name text := trim(organization_name);
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A verified account is required.';
  end if;

  if normalized_name = '' or char_length(normalized_name) > 120 then
    raise exception 'Organization name must contain 1 to 120 characters.';
  end if;

  insert into public.organizations (name, owner_id)
  values (normalized_name, auth.uid())
  returning id into created_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization, auth.uid(), 'owner');

  return created_organization;
end;
$$;

revoke all on function private.create_organization(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.create_organization(text) to authenticated;

create function public.create_organization(organization_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization(organization_name);
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

alter function public.read_cms_transfer_states(uuid) set schema private;

create or replace function private.read_cms_transfer_states(p_website_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A verified account is required.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'provider', integration.provider,
      'articleKey', transfer.article_key,
      'status', transfer.status,
      'remoteEditUrl', transfer.remote_edit_url,
      'fieldReport', transfer.field_report
    ) order by transfer.updated_at desc), '[]'::jsonb)
    from public.cms_transfers transfer
    join public.integrations integration on integration.id = transfer.integration_id
    join public.websites website on website.id = transfer.website_id
    where transfer.website_id = p_website_id
      and private.is_organization_member(website.organization_id)
  );
end;
$$;

revoke all on function private.read_cms_transfer_states(uuid) from public, anon, authenticated;
grant execute on function private.read_cms_transfer_states(uuid) to authenticated;

create function public.read_cms_transfer_states(p_website_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.read_cms_transfer_states(p_website_id);
$$;

revoke all on function public.read_cms_transfer_states(uuid) from public, anon;
grant execute on function public.read_cms_transfer_states(uuid) to authenticated;
