-- Turn the weekly execution system into a coach-first experience with truthful
-- completion evidence. Existing onboarding questions and answers are preserved.
alter table public.websites
  alter column plan_tier set default 'beginner';

update public.websites
set plan_tier = 'beginner',
    plan_selected_at = coalesce(plan_selected_at, now())
where plan_tier is null;

alter table public.quests
  add column verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  add column verified_at timestamptz,
  add column verification_method text;

alter table public.quests
  drop constraint if exists quests_task_type_check;

alter table public.quests
  add constraint quests_task_type_check check (
    task_type in (
      'business_confirmation', 'vocabulary_review', 'content_review',
      'primary_quest', 'distribution', 'keyword_review', 'reviews', 'measurement'
    )
  );

update public.quests
set task_type = 'business_confirmation',
    title = 'Confirm Destiny understands your business',
    description = 'Check the business, audience, problem, goals, and differentiator Destiny will use to guide every recommendation.',
    action_path = case
      when audit_id is not null then '/audits/' || audit_id::text || '#business-understanding'
      else '/results#business-understanding'
    end,
    estimated_minutes = 2,
    requires_approval = true
where task_type = 'vocabulary_review';

grant update (status, completed_at, verification_status, verified_at, verification_method)
  on public.quests to authenticated;
