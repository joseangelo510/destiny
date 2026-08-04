-- Optional private founder motivation shown in the coaching workspace.
-- This is deliberately separate from required onboarding questions.
alter table public.profiles
  add column if not exists founder_why text not null default '';

grant update (founder_why) on public.profiles to authenticated;

comment on column public.profiles.founder_why is
  'Optional private reminder of why the founder is building the business. Never presented as verified business evidence.';
