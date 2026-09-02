-- D10.7 Rebound Agent: website-isolated conversations and permissioned drafts.
-- Organization membership is resolved through public.organization_members by private.is_organization_member.

create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  partial boolean not null default false,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now()
);

create table public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  message_id uuid not null references public.agent_messages(id) on delete cascade,
  kind text not null default 'draft' check (kind = 'draft'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'failed')),
  result jsonb,
  artifact_id uuid references public.article_drafts(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index agent_conversations_website_user_idx
  on public.agent_conversations (website_id, user_id, updated_at desc);
create index agent_conversations_organization_idx
  on public.agent_conversations (organization_id);
create index agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at);
create index agent_messages_website_idx
  on public.agent_messages (website_id, created_at desc);
create index agent_messages_organization_idx
  on public.agent_messages (organization_id);
create index agent_proposals_conversation_idx
  on public.agent_proposals (conversation_id, created_at);
create index agent_proposals_message_idx
  on public.agent_proposals (message_id);
create index agent_proposals_website_status_idx
  on public.agent_proposals (website_id, status, created_at desc);
create index agent_proposals_organization_idx
  on public.agent_proposals (organization_id);
create index agent_proposals_decided_by_idx
  on public.agent_proposals (decided_by) where decided_by is not null;

create trigger agent_conversations_touch_updated_at
  before update on public.agent_conversations
  for each row execute procedure private.touch_updated_at();

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_proposals enable row level security;

create policy "agent_conversations_select_members" on public.agent_conversations
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = agent_conversations.website_id
        and website.organization_id = agent_conversations.organization_id
    )
  );
create policy "agent_conversations_insert_members" on public.agent_conversations
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = agent_conversations.website_id
        and website.organization_id = agent_conversations.organization_id
    )
  );
create policy "agent_conversations_update_members" on public.agent_conversations
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = agent_conversations.website_id
        and website.organization_id = agent_conversations.organization_id
    )
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and user_id = (select auth.uid())
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.websites website
      where website.id = agent_conversations.website_id
        and website.organization_id = agent_conversations.organization_id
    )
  );

create policy "agent_messages_select_members" on public.agent_messages
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.website_id = agent_messages.website_id
        and conversation.organization_id = agent_messages.organization_id
        and conversation.user_id = (select auth.uid())
    )
  );
create policy "agent_messages_insert_members" on public.agent_messages
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.website_id = agent_messages.website_id
        and conversation.organization_id = agent_messages.organization_id
        and conversation.user_id = (select auth.uid())
    )
  );
create policy "agent_messages_update_members" on public.agent_messages
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.website_id = agent_messages.website_id
        and conversation.organization_id = agent_messages.organization_id
        and conversation.user_id = (select auth.uid())
    )
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_messages.conversation_id
        and conversation.website_id = agent_messages.website_id
        and conversation.organization_id = agent_messages.organization_id
        and conversation.user_id = (select auth.uid())
    )
  );

create policy "agent_proposals_select_members" on public.agent_proposals
  for select to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_proposals.conversation_id
        and conversation.website_id = agent_proposals.website_id
        and conversation.organization_id = agent_proposals.organization_id
        and conversation.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.agent_messages message
      where message.id = agent_proposals.message_id
        and message.conversation_id = agent_proposals.conversation_id
        and message.website_id = agent_proposals.website_id
        and message.organization_id = agent_proposals.organization_id
    )
  );
create policy "agent_proposals_insert_members" on public.agent_proposals
  for insert to authenticated with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and status = 'proposed'
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_proposals.conversation_id
        and conversation.website_id = agent_proposals.website_id
        and conversation.organization_id = agent_proposals.organization_id
        and conversation.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.agent_messages message
      where message.id = agent_proposals.message_id
        and message.conversation_id = agent_proposals.conversation_id
        and message.website_id = agent_proposals.website_id
        and message.organization_id = agent_proposals.organization_id
    )
  );
create policy "agent_proposals_update_members" on public.agent_proposals
  for update to authenticated using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and status = 'proposed'
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_proposals.conversation_id
        and conversation.website_id = agent_proposals.website_id
        and conversation.organization_id = agent_proposals.organization_id
        and conversation.user_id = (select auth.uid())
    )
  ) with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and status in ('approved', 'rejected', 'failed')
    and decided_by = (select auth.uid())
    and decided_at is not null
    and private.is_organization_member(organization_id)
    and exists (
      select 1 from public.agent_conversations conversation
      where conversation.id = agent_proposals.conversation_id
        and conversation.website_id = agent_proposals.website_id
        and conversation.organization_id = agent_proposals.organization_id
        and conversation.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.agent_messages message
      where message.id = agent_proposals.message_id
        and message.conversation_id = agent_proposals.conversation_id
        and message.website_id = agent_proposals.website_id
        and message.organization_id = agent_proposals.organization_id
    )
  );

revoke all on table public.agent_conversations, public.agent_messages, public.agent_proposals
  from public, anon, authenticated;
grant select, insert, update on public.agent_conversations to authenticated;
grant select, insert, update on public.agent_messages to authenticated;
grant select, insert, update on public.agent_proposals to authenticated;

comment on table public.agent_conversations is
  'User-owned, website-scoped Rebound Agent conversations.';
comment on table public.agent_messages is
  'Persistent Rebound Agent messages with bounded token receipts.';
comment on table public.agent_proposals is
  'Permission cards; v1 supports draft creation only.';
