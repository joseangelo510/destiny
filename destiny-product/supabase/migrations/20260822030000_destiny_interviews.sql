-- Destiny Interviews: website-isolated expertise capture and Voice Library.
-- Typed interviews ship first. Audio columns reserve the approved 30-day
-- retention contract without enabling recording before transcription exists.

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  audit_id uuid references public.audits(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  topic_title text not null check (char_length(topic_title) between 1 and 240),
  focus_keyword text not null default '' check (char_length(focus_keyword) <= 300),
  mode text not null default 'typed' check (mode in ('typed', 'dictated', 'voice')),
  status text not null default 'in_progress' check (status in ('in_progress', 'partial', 'complete')),
  question_count integer not null check (question_count between 1 and 20),
  current_position integer not null default 1 check (current_position between 1 and 20),
  consent_snapshot jsonb not null default '{"typed_source_notice":true,"audio_retention_days":30}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  kind text not null check (kind in ('warm_up','contrarian','story','change','evidence','product_tie_in','audience_advice','follow_up')),
  text text not null check (char_length(text) between 1 and 1000),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (interview_id, position)
);

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verbatim_text text not null check (char_length(verbatim_text) between 1 and 20000),
  raw_transcript text,
  speaker_corrected_text text,
  audio_object_path text,
  audio_delete_after timestamptz,
  retracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (question_id)
);

create table public.voice_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  answer_id uuid not null references public.interview_answers(id) on delete cascade,
  type text not null check (type in ('pov','story','evidence','audience_pain','product_note','voice_marker','theme')),
  title text not null check (char_length(title) between 1 and 240),
  body text not null check (char_length(body) between 1 and 4000),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'array' and jsonb_array_length(provenance) > 0),
  status text not null default 'suggested' check (status in ('suggested','confirmed_by_owner','rejected_by_owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (answer_id, type)
);

alter table public.article_drafts add column if not exists interview_id uuid references public.interviews(id) on delete set null;

create index interviews_website_status_idx on public.interviews (website_id, status, updated_at desc);
create index interviews_organization_idx on public.interviews (organization_id);
create index interviews_created_by_idx on public.interviews (created_by);
create index interview_questions_website_idx on public.interview_questions (website_id, interview_id, position);
create index interview_questions_organization_idx on public.interview_questions (organization_id);
create index interview_answers_website_idx on public.interview_answers (website_id, interview_id, created_at);
create index interview_answers_organization_idx on public.interview_answers (organization_id);
create index interview_answers_user_idx on public.interview_answers (user_id);
create index voice_library_items_website_idx on public.voice_library_items (website_id, status, updated_at desc);
create index voice_library_items_interview_idx on public.voice_library_items (interview_id);
create index voice_library_items_answer_idx on public.voice_library_items (answer_id);
create index voice_library_items_organization_idx on public.voice_library_items (organization_id);
create index article_drafts_interview_idx on public.article_drafts (interview_id) where interview_id is not null;

create trigger interviews_touch_updated_at before update on public.interviews
  for each row execute procedure private.touch_updated_at();
create trigger voice_library_items_touch_updated_at before update on public.voice_library_items
  for each row execute procedure private.touch_updated_at();

create or replace function private.protect_interview_verbatim_text()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if new.verbatim_text is distinct from old.verbatim_text
    or new.raw_transcript is distinct from old.raw_transcript then
    raise exception 'Interview verbatim text is immutable';
  end if;
  return new;
end;
$$;

create trigger interview_answers_protect_verbatim
  before update on public.interview_answers
  for each row execute procedure private.protect_interview_verbatim_text();

alter table public.interviews enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.voice_library_items enable row level security;

create policy "interviews_select_members" on public.interviews for select to authenticated using (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interviews.website_id and website.organization_id = interviews.organization_id)
);
create policy "interviews_insert_members" on public.interviews for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interviews.website_id and website.organization_id = interviews.organization_id)
);
create policy "interviews_update_members" on public.interviews for update to authenticated using (
  private.is_organization_member(organization_id)
) with check (
  created_by = (select auth.uid()) and private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interviews.website_id and website.organization_id = interviews.organization_id)
);
create policy "interviews_delete_members" on public.interviews for delete to authenticated using (
  private.is_organization_member(organization_id)
);

create policy "interview_questions_select_members" on public.interview_questions for select to authenticated using (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interview_questions.website_id and website.organization_id = interview_questions.organization_id)
);
create policy "interview_questions_insert_members" on public.interview_questions for insert to authenticated with check (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.interviews interview where interview.id = interview_questions.interview_id and interview.website_id = interview_questions.website_id and interview.organization_id = interview_questions.organization_id)
);
create policy "interview_questions_update_members" on public.interview_questions for update to authenticated using (
  private.is_organization_member(organization_id)
) with check (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.interviews interview where interview.id = interview_questions.interview_id and interview.website_id = interview_questions.website_id and interview.organization_id = interview_questions.organization_id)
);

create policy "interview_answers_select_members" on public.interview_answers for select to authenticated using (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interview_answers.website_id and website.organization_id = interview_answers.organization_id)
  and retracted_at is null
);
create policy "interview_answers_insert_members" on public.interview_answers for insert to authenticated with check (
  user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  and exists (select 1 from public.interviews interview where interview.id = interview_answers.interview_id and interview.website_id = interview_answers.website_id and interview.organization_id = interview_answers.organization_id)
  and exists (select 1 from public.interview_questions question where question.id = interview_answers.question_id and question.interview_id = interview_answers.interview_id)
);
create policy "interview_answers_update_members" on public.interview_answers for update to authenticated using (
  user_id = (select auth.uid()) and private.is_organization_member(organization_id)
) with check (
  user_id = (select auth.uid()) and private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = interview_answers.website_id and website.organization_id = interview_answers.organization_id)
);
create policy "interview_answers_delete_members" on public.interview_answers for delete to authenticated using (
  user_id = (select auth.uid()) and private.is_organization_member(organization_id)
);

create policy "voice_library_items_select_members" on public.voice_library_items for select to authenticated using (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = voice_library_items.website_id and website.organization_id = voice_library_items.organization_id)
);
create policy "voice_library_items_insert_members" on public.voice_library_items for insert to authenticated with check (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.interviews interview where interview.id = voice_library_items.interview_id and interview.website_id = voice_library_items.website_id and interview.organization_id = voice_library_items.organization_id)
  and exists (select 1 from public.interview_answers answer where answer.id = voice_library_items.answer_id and answer.interview_id = voice_library_items.interview_id and answer.retracted_at is null)
);
create policy "voice_library_items_update_members" on public.voice_library_items for update to authenticated using (
  private.is_organization_member(organization_id)
) with check (
  private.is_organization_member(organization_id)
  and exists (select 1 from public.websites website where website.id = voice_library_items.website_id and website.organization_id = voice_library_items.organization_id)
);
create policy "voice_library_items_delete_members" on public.voice_library_items for delete to authenticated using (
  private.is_organization_member(organization_id)
);

revoke all on table public.interviews, public.interview_questions, public.interview_answers, public.voice_library_items from public, anon, authenticated;
grant select, insert, update, delete on table public.interviews to authenticated;
grant select, insert, update on table public.interview_questions to authenticated;
grant select, insert, delete on table public.interview_answers to authenticated;
grant update (speaker_corrected_text, retracted_at) on table public.interview_answers to authenticated;
grant select, insert, update, delete on table public.voice_library_items to authenticated;
grant select, insert, update, delete on table public.interviews, public.interview_questions, public.interview_answers, public.voice_library_items to service_role;

comment on table public.interviews is 'Website-scoped Destiny expertise interviews. Available on every plan.';
comment on table public.interview_answers is 'Immutable verbatim interview source. Typed answers persist; future audio expires after 30 days while transcripts remain.';
comment on table public.voice_library_items is 'AI interpretations with exact answer provenance. Rejected items are excluded from content retrieval.';
