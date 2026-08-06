create index rank_tracker_lists_created_by_idx
  on public.rank_tracker_lists (created_by);

create index tracked_keywords_created_by_idx
  on public.tracked_keywords (created_by);
