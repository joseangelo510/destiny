create index if not exists llm_visibility_tasks_completed_by_idx
  on public.llm_visibility_tasks (completed_by)
  where completed_by is not null;

comment on index public.llm_visibility_tasks_completed_by_idx is
  'Supports profile deletion and administrative lookups without scanning all LLM visibility tasks.';
