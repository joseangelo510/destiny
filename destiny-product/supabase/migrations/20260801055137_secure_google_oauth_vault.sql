-- Short-lived OAuth state is kept outside the Data API. Google credentials are
-- encrypted with Supabase Vault; public.integrations stores only the Vault UUID.

create table private.google_oauth_states (
  state_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  provider text not null check (provider in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index google_oauth_states_expiry_idx on private.google_oauth_states (expires_at);
revoke all on private.google_oauth_states from public, anon, authenticated;

create or replace function public.begin_google_oauth_state(
  p_state_hash text,
  p_user_id uuid,
  p_website_id uuid,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_provider not in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube') then
    raise exception 'Unsupported Google integration.';
  end if;
  if char_length(p_state_hash) <> 64 then
    raise exception 'Invalid OAuth state.';
  end if;
  if not exists (
    select 1
    from public.websites website
    join public.organization_members membership on membership.organization_id = website.organization_id
    where website.id = p_website_id and membership.user_id = p_user_id
  ) then
    raise exception 'Website access denied.';
  end if;

  delete from private.google_oauth_states where expires_at <= now();
  insert into private.google_oauth_states (state_hash, user_id, website_id, provider, expires_at)
  values (p_state_hash, p_user_id, p_website_id, p_provider, now() + interval '10 minutes');
end;
$$;

create or replace function public.consume_google_oauth_state(p_state_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_state private.google_oauth_states%rowtype;
begin
  delete from private.google_oauth_states
  where state_hash = p_state_hash and expires_at > now()
  returning * into v_state;

  if v_state.state_hash is null then
    raise exception 'OAuth state is invalid or expired.';
  end if;

  return jsonb_build_object(
    'userId', v_state.user_id,
    'websiteId', v_state.website_id,
    'provider', v_state.provider
  );
end;
$$;

create or replace function public.store_google_oauth_connection(
  p_user_id uuid,
  p_website_id uuid,
  p_provider text,
  p_scopes text[],
  p_token jsonb
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
  v_existing_token jsonb := '{}'::jsonb;
  v_token jsonb := coalesce(p_token, '{}'::jsonb);
begin
  if p_provider not in ('google_search_console', 'google_analytics', 'google_business_profile', 'youtube') then
    raise exception 'Unsupported Google integration.';
  end if;
  if coalesce(v_token ->> 'access_token', '') = '' then
    raise exception 'Google did not return an access token.';
  end if;

  select website.organization_id
    into v_organization_id
  from public.websites website
  join public.organization_members membership
    on membership.organization_id = website.organization_id
   and membership.user_id = p_user_id
  where website.id = p_website_id;
  if v_organization_id is null then
    raise exception 'Website access denied.';
  end if;

  select integration.id,
         case when integration.credential_reference ~ '^[0-9a-fA-F-]{36}$'
              then integration.credential_reference::uuid else null end
    into v_integration_id, v_secret_id
  from public.integrations integration
  where integration.organization_id = v_organization_id
    and integration.website_id = p_website_id
    and integration.provider = p_provider;

  v_integration_id := coalesce(v_integration_id, gen_random_uuid());
  if v_secret_id is not null then
    select coalesce(decrypted_secret::jsonb, '{}'::jsonb)
      into v_existing_token
    from vault.decrypted_secrets
    where id = v_secret_id;
  end if;
  if coalesce(v_token ->> 'refresh_token', '') = '' and coalesce(v_existing_token ->> 'refresh_token', '') <> '' then
    v_token := jsonb_set(v_token, '{refresh_token}', to_jsonb(v_existing_token ->> 'refresh_token'));
  end if;

  if v_secret_id is null then
    select vault.create_secret(
      v_token::text,
      'destiny_google_' || replace(v_integration_id::text, '-', '_'),
      'Encrypted Google OAuth token for Destiny integration ' || v_integration_id::text
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_secret_id,
      v_token::text,
      'destiny_google_' || replace(v_integration_id::text, '-', '_'),
      'Encrypted Google OAuth token for Destiny integration ' || v_integration_id::text
    );
  end if;

  insert into public.integrations (
    id, organization_id, website_id, provider, status, scopes,
    credential_reference, metadata, connected_at, updated_at
  ) values (
    v_integration_id, v_organization_id, p_website_id, p_provider, 'connected', coalesce(p_scopes, '{}'),
    v_secret_id::text,
    jsonb_build_object(
      'token_type', v_token ->> 'token_type',
      'expires_at', v_token ->> 'expires_at',
      'scope', v_token ->> 'scope'
    ),
    now(), now()
  )
  on conflict (organization_id, website_id, provider) do update set
    status = 'connected',
    scopes = excluded.scopes,
    credential_reference = excluded.credential_reference,
    metadata = excluded.metadata,
    connected_at = now(),
    updated_at = now();

  return v_integration_id;
end;
$$;

create or replace function public.read_google_oauth_credentials(
  p_integration_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_token jsonb;
begin
  select integration.credential_reference::uuid
    into v_secret_id
  from public.integrations integration
  join public.organization_members membership on membership.organization_id = integration.organization_id
  where integration.id = p_integration_id
    and membership.user_id = p_user_id
    and integration.credential_reference ~ '^[0-9a-fA-F-]{36}$';
  if v_secret_id is null then
    raise exception 'Integration credentials not found.';
  end if;

  select decrypted_secret::jsonb into v_token
  from vault.decrypted_secrets where id = v_secret_id;
  return v_token;
end;
$$;

revoke all on function public.begin_google_oauth_state(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_google_oauth_state(text) from public, anon, authenticated;
revoke all on function public.store_google_oauth_connection(uuid, uuid, text, text[], jsonb) from public, anon, authenticated;
revoke all on function public.read_google_oauth_credentials(uuid, uuid) from public, anon, authenticated;

grant execute on function public.begin_google_oauth_state(text, uuid, uuid, text) to service_role;
grant execute on function public.consume_google_oauth_state(text) to service_role;
grant execute on function public.store_google_oauth_connection(uuid, uuid, text, text[], jsonb) to service_role;
grant execute on function public.read_google_oauth_credentials(uuid, uuid) to service_role;
