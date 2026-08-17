alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube', 'wordpress'));

create or replace function public.store_cms_connection(
  p_user_id uuid,
  p_website_id uuid,
  p_provider text,
  p_credentials jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_organization_id uuid;
  v_integration_id uuid;
  v_secret_id uuid;
begin
  if p_provider <> 'wordpress' then raise exception 'Unsupported CMS integration.'; end if;
  if coalesce(p_credentials ->> 'site_url', '') = ''
     or coalesce(p_credentials ->> 'username', '') = ''
     or coalesce(p_credentials ->> 'application_password', '') = '' then
    raise exception 'CMS credentials are incomplete.';
  end if;

  select website.organization_id into v_organization_id
  from public.websites website
  join public.organization_members membership
    on membership.organization_id = website.organization_id and membership.user_id = p_user_id
  where website.id = p_website_id;
  if v_organization_id is null then raise exception 'Website access denied.'; end if;

  select integration.id,
         case when integration.credential_reference ~ '^[0-9a-fA-F-]{36}$' then integration.credential_reference::uuid else null end
    into v_integration_id, v_secret_id
  from public.integrations integration
  where integration.organization_id = v_organization_id
    and integration.website_id = p_website_id
    and integration.provider = p_provider;

  v_integration_id := coalesce(v_integration_id, gen_random_uuid());
  if v_secret_id is null then
    select vault.create_secret(p_credentials::text, 'destiny_cms_' || replace(v_integration_id::text, '-', '_'), 'Encrypted CMS credential for Destiny integration ' || v_integration_id::text) into v_secret_id;
  else
    perform vault.update_secret(v_secret_id, p_credentials::text, 'destiny_cms_' || replace(v_integration_id::text, '-', '_'), 'Encrypted CMS credential for Destiny integration ' || v_integration_id::text);
  end if;

  insert into public.integrations (id, organization_id, website_id, provider, status, scopes, credential_reference, metadata, connected_at, updated_at)
  values (v_integration_id, v_organization_id, p_website_id, p_provider, 'connected', array['posts:read','posts:write','media:write'], v_secret_id::text, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (organization_id, website_id, provider) do update set
    status = 'connected', scopes = excluded.scopes, credential_reference = excluded.credential_reference,
    metadata = excluded.metadata, connected_at = now(), updated_at = now();

  insert into public.notifications (organization_id, user_id, kind, title, body, destination_path)
  values (v_organization_id, p_user_id, 'integration', 'WordPress connected', 'Approved content can now move to the connected WordPress workflow.', '/content');
  return v_integration_id;
end;
$$;

revoke all on function public.store_cms_connection(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_cms_connection(uuid, uuid, text, jsonb, jsonb) to service_role;
