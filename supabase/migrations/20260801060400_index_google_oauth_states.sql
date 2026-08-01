-- Support cascade deletes and ownership lookups without scanning the
-- short-lived Google OAuth state table.
create index google_oauth_states_user_idx
  on private.google_oauth_states (user_id);

create index google_oauth_states_website_idx
  on private.google_oauth_states (website_id);
