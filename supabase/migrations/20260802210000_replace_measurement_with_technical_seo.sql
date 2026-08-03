-- Keep performance reporting inside Analytics and make the fourth weekly
-- coaching category actionable technical SEO work.
alter table public.quests
  drop constraint if exists quests_task_type_check;

alter table public.quests
  add constraint quests_task_type_check check (
    task_type in (
      'business_confirmation', 'vocabulary_review', 'content_review',
      'primary_quest', 'distribution', 'keyword_review', 'reviews', 'measurement',
      'community_distribution', 'social_distribution', 'publisher_outreach',
      'directory_growth', 'technical_review'
    )
  );

update public.quests
set task_type = 'technical_review',
    category = 'technical',
    title = 'Run a PageSpeed and deeper technical check',
    description = 'Destiny keeps onboarding fast by checking the homepage first. This follow-up reviews performance and the wider technical foundation after your initial strategy is ready.',
    action_path = '/audits/' || audit_id::text || '#technical-evidence',
    estimated_minutes = 20,
    requires_approval = false
where task_type = 'measurement'
  and status in ('todo', 'in_progress', 'skipped');
