create table public.cms_transfers (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  article_key text not null,
  content_hash text not null,
  remote_id text,
  remote_edit_url text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_class text,
  error_detail text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, article_key)
);

alter table public.cms_transfers enable row level security;
revoke all on table public.cms_transfers from public, anon, authenticated;
grant select, insert, update on table public.cms_transfers to service_role;

create index cms_transfers_website_created_idx
  on public.cms_transfers (website_id, created_at desc);

create or replace function public.read_wordpress_connection_credentials(
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
    and integration.provider = 'wordpress'
    and integration.status = 'connected'
    and membership.user_id = p_user_id
    and integration.credential_reference ~ '^[0-9a-fA-F-]{36}$';

  if v_integration_id is null or v_secret_id is null then
    raise exception 'Connected WordPress credentials not found.';
  end if;

  select decrypted_secret::jsonb into v_credentials
  from vault.decrypted_secrets
  where id = v_secret_id;

  if v_credentials is null then raise exception 'Connected WordPress credentials not found.'; end if;
  return jsonb_build_object('integration_id', v_integration_id, 'credentials', v_credentials);
end;
$$;

revoke all on function public.read_wordpress_connection_credentials(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_wordpress_connection_credentials(uuid, uuid) to service_role;
