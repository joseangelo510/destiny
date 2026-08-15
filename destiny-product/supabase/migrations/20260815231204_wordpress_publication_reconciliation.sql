-- Keep transport success separate from the current WordPress publication
-- state. cms_transfers remains service-role-only; authenticated users receive
-- only the safe projection exposed by read_cms_transfer_states.
alter table public.cms_transfers
  add column if not exists publication_status text,
  add column if not exists remote_status text,
  add column if not exists remote_permalink text,
  add column if not exists remote_modified_at timestamptz,
  add column if not exists remote_content_hash text,
  add column if not exists delivered_fingerprint text,
  add column if not exists featured_media_id bigint,
  add column if not exists media_ids jsonb not null default '[]'::jsonb,
  add column if not exists seo_title_rendered text,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists verified_live_at timestamptz,
  add column if not exists verification_evidence jsonb,
  add column if not exists scheduled_for timestamptz;

alter table public.cms_transfers
  drop constraint if exists cms_transfers_publication_status_check;

alter table public.cms_transfers
  add constraint cms_transfers_publication_status_check check (
    publication_status is null or publication_status in (
      'delivering', 'delivered_draft', 'scheduled', 'published_unverified',
      'verified_live', 'changed_in_cms', 'stale', 'unpublished',
      'delivery_failed', 'verification_failed', 'delivered_incomplete'
    )
  );

update public.cms_transfers transfer
set publication_status = case
  when transfer.status = 'pending' then 'delivering'
  when transfer.status = 'failed' then 'delivery_failed'
  else 'delivered_draft'
end
from public.integrations integration
where integration.id = transfer.integration_id
  and integration.provider = 'wordpress'
  and transfer.publication_status is null;

create index if not exists cms_transfers_wordpress_reconcile_idx
  on public.cms_transfers (publication_status, last_reconciled_at, updated_at desc)
  where remote_id is not null;

-- The Edge Functions also need non-secret CMS metadata, such as the estimated
-- site-title suffix. Credentials remain decrypted only inside this service-role RPC.
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
  v_metadata jsonb;
begin
  select integration.id, integration.credential_reference::uuid, integration.metadata
    into v_integration_id, v_secret_id, v_metadata
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
  return jsonb_build_object(
    'integration_id', v_integration_id,
    'credentials', v_credentials,
    'metadata', coalesce(v_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.read_wordpress_connection_credentials(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_wordpress_connection_credentials(uuid, uuid) to service_role;

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
      'publicationStatus', transfer.publication_status,
      'remoteEditUrl', transfer.remote_edit_url,
      'remotePermalink', transfer.remote_permalink,
      'remoteStatus', transfer.remote_status,
      'lastReconciledAt', transfer.last_reconciled_at,
      'verifiedLiveAt', transfer.verified_live_at,
      'verificationEvidence', transfer.verification_evidence,
      'seoTitleRendered', transfer.seo_title_rendered,
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
