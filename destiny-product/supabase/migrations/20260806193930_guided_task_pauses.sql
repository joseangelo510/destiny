-- Preserve completion semantics while making paused work explicit and resumable.
alter table public.quests
  add column guidance_state text not null default 'active'
    check (guidance_state in ('active', 'waiting', 'blocked')),
  add column follow_up_at timestamptz,
  add column blocker_reason text,
  add column blocker_owner text;

alter table public.quests
  add constraint quests_guidance_state_details_check check (
    (guidance_state = 'active' and follow_up_at is null and blocker_reason is null and blocker_owner is null)
    or (guidance_state = 'waiting' and follow_up_at is not null and blocker_reason is null and blocker_owner is null)
    or (guidance_state = 'blocked' and follow_up_at is null and blocker_reason is not null and blocker_owner is not null)
  );

create index quests_guidance_resurface_idx
  on public.quests (website_id, guidance_state, follow_up_at)
  where status <> 'complete';

grant update (guidance_state, follow_up_at, blocker_reason, blocker_owner)
  on public.quests to authenticated;
