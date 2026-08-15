alter table public.websites
  add column if not exists problem_solved text not null default '',
  add column if not exists audience_challenges_goals text not null default '';

grant update (problem_solved, audience_challenges_goals) on public.websites to authenticated;
