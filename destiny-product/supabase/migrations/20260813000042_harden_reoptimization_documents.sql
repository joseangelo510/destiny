revoke all on public.reoptimization_documents from anon;

create index if not exists reoptimization_documents_organization_idx
  on public.reoptimization_documents (organization_id);

create index if not exists reoptimization_documents_user_idx
  on public.reoptimization_documents (user_id);
