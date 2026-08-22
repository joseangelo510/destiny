-- The browser-role hardening migration revokes PUBLIC privileges. On a fresh
-- stack, service_role previously inherited part of its Data API access through
-- PUBLIC, so that revoke made worker inserts fail even though hosted projects
-- with legacy explicit grants kept working. Make the worker ACL deterministic
-- on fresh and hosted-parity databases without changing anon, authenticated,
-- or row-level-security boundaries.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
