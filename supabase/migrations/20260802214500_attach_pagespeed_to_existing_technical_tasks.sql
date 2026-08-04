-- New audits receive this URL from the audit worker. Backfill the same action
-- for unfinished technical tasks converted from the former measurement task.
update public.quests as quest
set external_url = 'https://pagespeed.web.dev/analysis?url=' || website.url
from public.websites as website
where quest.website_id = website.id
  and quest.task_type = 'technical_review'
  and quest.external_url is null;
