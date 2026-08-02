alter table public.llm_visibility_tasks
  add column proof_url text,
  add column proof_attached_at timestamptz,
  add constraint llm_visibility_tasks_public_proof_consistency check (
    (proof_url is null and proof_attached_at is null) or
    (
      status = 'complete' and
      proof_url ~ '^https://[^[:space:]]+$' and
      proof_attached_at is not null
    )
  );

grant update (proof_url, proof_attached_at)
  on public.llm_visibility_tasks
  to authenticated;
