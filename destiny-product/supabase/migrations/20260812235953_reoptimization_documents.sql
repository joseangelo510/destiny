create table if not exists public.reoptimization_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  keyword text not null,
  normalized_keyword text not null,
  page_url text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  manifest jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, normalized_keyword)
);

create index if not exists reoptimization_documents_website_idx
  on public.reoptimization_documents (website_id, updated_at desc);

alter table public.reoptimization_documents enable row level security;

create policy "Members can read reoptimization documents"
  on public.reoptimization_documents for select to authenticated
  using (private.is_organization_member(organization_id));

create policy "Members can create reoptimization documents"
  on public.reoptimization_documents for insert to authenticated
  with check (private.is_organization_member(organization_id) and user_id = (select auth.uid()));

create policy "Owners can update reoptimization documents"
  on public.reoptimization_documents for update to authenticated
  using (private.is_organization_member(organization_id) and user_id = (select auth.uid()))
  with check (private.is_organization_member(organization_id) and user_id = (select auth.uid()));

grant select, insert, update on public.reoptimization_documents to authenticated;
