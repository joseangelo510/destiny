alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube', 'wordpress', 'webflow'));

-- Extend the CMS connection store to Webflow while keeping WordPress behavior
-- byte-for-byte identical (same validation, scopes, and notification copy).
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
  v_scopes text[];
  v_notification_title text;
  v_notification_body text;
begin
  if p_provider = 'wordpress' then
    if coalesce(p_credentials ->> 'site_url', '') = ''
       or coalesce(p_credentials ->> 'username', '') = ''
       or coalesce(p_credentials ->> 'application_password', '') = '' then
      raise exception 'CMS credentials are incomplete.';
    end if;
    v_scopes := array['posts:read', 'posts:write', 'media:write'];
    v_notification_title := 'WordPress connected';
    v_notification_body := 'Approved content can now move to the connected WordPress workflow.';
  elsif p_provider = 'webflow' then
    if coalesce(p_credentials ->> 'api_token', '') = ''
       or coalesce(p_credentials ->> 'site_id', '') = ''
       or coalesce(p_credentials ->> 'collection_id', '') = ''
       or coalesce(p_credentials ->> 'body_field', '') = '' then
      raise exception 'CMS credentials are incomplete.';
    end if;
    v_scopes := array['cms:read', 'cms:write'];
    v_notification_title := 'Webflow connected';
    v_notification_body := 'Approved content can now move into the connected Webflow CMS collection as drafts.';
  else
    raise exception 'Unsupported CMS integration.';
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
  values (v_integration_id, v_organization_id, p_website_id, p_provider, 'connected', v_scopes, v_secret_id::text, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (organization_id, website_id, provider) do update set
    status = 'connected', scopes = excluded.scopes, credential_reference = excluded.credential_reference,
    metadata = excluded.metadata, connected_at = now(), updated_at = now();

  insert into public.notifications (organization_id, user_id, kind, title, body, destination_path)
  values (v_organization_id, p_user_id, 'integration', v_notification_title, v_notification_body, '/content');
  return v_integration_id;
end;
$$;

revoke all on function public.store_cms_connection(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_cms_connection(uuid, uuid, text, jsonb, jsonb) to service_role;

create or replace function public.read_webflow_connection_credentials(
  p_user_id uuid,
  p_website_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_integration_id uuid;
  v_secret_id uuid;
  v_credentials jsonb;
begin
  select integration.id, integration.credential_reference::uuid
    into v_integration_id, v_secret_id
  from public.integrations integration
  join public.organization_members membership
    on membership.organization_id = integration.organization_id
  where integration.website_id = p_website_id
    and integration.provider = 'webflow'
    and integration.status = 'connected'
    and membership.user_id = p_user_id
    and integration.credential_reference ~ '^[0-9a-fA-F-]{36}$';

  if v_integration_id is null or v_secret_id is null then
    raise exception 'Connected Webflow credentials not found.';
  end if;

  select decrypted_secret::jsonb into v_credentials
  from vault.decrypted_secrets
  where id = v_secret_id;

  if v_credentials is null then raise exception 'Connected Webflow credentials not found.'; end if;
  return jsonb_build_object('integration_id', v_integration_id, 'credentials', v_credentials);
end;
$$;

revoke all on function public.read_webflow_connection_credentials(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_webflow_connection_credentials(uuid, uuid) to service_role;
