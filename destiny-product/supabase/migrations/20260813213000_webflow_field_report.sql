-- Per-article CMS readiness checklist: which fields were transferred, which
-- were unavailable in the collection, and which still require review.
alter table public.cms_transfers add column if not exists field_report jsonb;

-- Public bucket hosting Destiny's original article graphics so Webflow can
-- ingest them into image fields. Written only by the service role.
insert into storage.buckets (id, name, public)
values ('article-graphics', 'article-graphics', true)
on conflict (id) do nothing;

drop policy if exists "article graphics are publicly readable" on storage.objects;
create policy "article graphics are publicly readable"
on storage.objects for select
using (bucket_id = 'article-graphics');

-- Lets the workspace UI hydrate prior CMS transfer state (Update vs Send,
-- readiness checklist) after a reload. Scoped to websites the caller can
-- access; cms_transfers itself stays service-role only.
create or replace function public.read_cms_transfer_states(p_website_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private
as $$
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
    and private.is_organization_member(website.organization_id);
$$;

revoke all on function public.read_cms_transfer_states(uuid) from public, anon;
grant execute on function public.read_cms_transfer_states(uuid) to authenticated;
