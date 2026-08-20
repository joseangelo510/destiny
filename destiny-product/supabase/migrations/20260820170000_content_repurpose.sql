-- ---------------------------------------------------------------------------
-- repurpose_sources
-- Stores source ingestion metadata and generated draft fields for the
-- Repurpose feature. Records are draft-only; nothing here constitutes
-- publication approval.
-- ---------------------------------------------------------------------------

create table public.repurpose_sources (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  website_id           uuid not null references public.websites(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,

  -- Source metadata
  source_kind          text not null check (source_kind in ('file', 'paste', 'url', 'youtube')),
  source_name          text not null check (char_length(source_name) between 1 and 500),
  source_url           text check (source_url is null or char_length(source_url) between 1 and 2048),
  mime_type            text check (mime_type is null or char_length(mime_type) between 1 and 255),
  source_size_bytes    bigint not null default 0
                         check (source_size_bytes >= 0 and source_size_bytes <= 20971520),

  -- Source plaintext is encrypted by the server before persistence. Authenticated
  -- clients may select this row, but no plaintext source column exists.
  extracted_text_ciphertext text not null
                          check (char_length(extracted_text_ciphertext) between 40 and 700000),
  extracted_characters integer not null check (extracted_characters between 1 and 120000),
  encryption_version   text not null default 'aes-256-gcm-v1'
                          check (encryption_version = 'aes-256-gcm-v1'),

  -- Lifecycle status
  status               text not null default 'ready'
                         check (status in ('ready', 'writing', 'failed')),

  -- Generation output fields (nullable until first successful generation)
  output_type          text check (
                         output_type is null or output_type in (
                           'seo_blog_article', 'linkedin_post', 'x_thread',
                           'email', 'faq', 'outline'
                         )
                       ),
  target_keyword       text check (target_keyword is null or char_length(target_keyword) <= 300),
  draft_title          text check (draft_title is null or char_length(draft_title) <= 120),
  draft_body           text check (draft_body is null or char_length(draft_body) <= 50000),
  draft_metadata       jsonb check (draft_metadata is null or jsonb_typeof(draft_metadata) = 'object'),

  -- Retry tracking
  generation_attempts  integer not null default 0 check (generation_attempts >= 0),
  last_error_code      text check (last_error_code is null or char_length(last_error_code) <= 100),
  last_error_message   text check (last_error_message is null or char_length(last_error_message) <= 500),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index repurpose_sources_website_status_idx
  on public.repurpose_sources (website_id, status, updated_at desc);

create index repurpose_sources_organization_idx
  on public.repurpose_sources (organization_id);

create index repurpose_sources_user_idx
  on public.repurpose_sources (user_id);

-- ---------------------------------------------------------------------------
-- Touch trigger
-- ---------------------------------------------------------------------------

create trigger repurpose_sources_touch_updated_at
  before update on public.repurpose_sources
  for each row execute procedure private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.repurpose_sources enable row level security;

-- SELECT: only the authenticated uploader may read the row. This keeps
-- extracted source text private from other members of the same organization.
create policy "repurpose_sources_select_members" on public.repurpose_sources
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites w
      where w.id = repurpose_sources.website_id
        and w.organization_id = repurpose_sources.organization_id
    )
  );

-- INSERT: authenticated non-anonymous org members; user_id must equal auth.uid()
create policy "repurpose_sources_insert_members" on public.repurpose_sources
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites w
      where w.id = repurpose_sources.website_id
        and w.organization_id = repurpose_sources.organization_id
    )
  );

-- UPDATE: non-anonymous org member; preserve org/site relationship; current user must own the row
create policy "repurpose_sources_update_members" on public.repurpose_sources
  for update to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
  )
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1
      from public.websites w
      where w.id = repurpose_sources.website_id
        and w.organization_id = repurpose_sources.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on table public.repurpose_sources from public, anon;
grant select, insert on table public.repurpose_sources to authenticated;
grant update (
  status,
  output_type,
  target_keyword,
  draft_title,
  draft_body,
  draft_metadata,
  generation_attempts,
  last_error_code,
  last_error_message,
  updated_at
) on table public.repurpose_sources to authenticated;
grant select, insert, update, delete on table public.repurpose_sources to service_role;

-- ---------------------------------------------------------------------------
-- Comment
-- ---------------------------------------------------------------------------

comment on table public.repurpose_sources is
  'Source ingestion records and generated draft fields for the Repurpose feature. '
  'Records are draft-only; nothing here constitutes publication approval.';
