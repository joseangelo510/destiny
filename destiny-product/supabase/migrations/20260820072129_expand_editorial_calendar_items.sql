alter table public.publishing_schedule_items
  drop constraint if exists publishing_schedule_items_position_check;

alter table public.publishing_schedule_items
  add constraint publishing_schedule_items_position_check
  check (position between 1 and 72);

alter table public.publishing_schedule_items
  add column if not exists related_article_title text
  check (related_article_title is null or char_length(related_article_title) between 1 and 500);

comment on column public.publishing_schedule_items.related_article_title is
  'Optional parent article title for a LinkedIn or X post shown in the editorial calendar.';
