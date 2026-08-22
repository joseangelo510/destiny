-- Zero rows means browser-role grants, RLS policies, functions, sequences, and
-- views agree with Destiny's authenticated-only workspace boundary.
with recursive
browser_roles(role_name) as (
  values ('anon'::name), ('authenticated'::name)
),
table_grants as (
  select table_name, grantee::name as role_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
),
policy_commands as (
  select
    tablename as table_name,
    cmd,
    roles
  from pg_policies
  where schemaname = 'public'
),
violations as (
  select
    'anonymous_table_grant'::text as check_name,
    grant_row.table_name::text as object_name,
    grant_row.privilege_type::text as detail
  from table_grants grant_row
  where grant_row.role_name = 'anon'

  union all

  select
    'unsafe_authenticated_table_grant',
    grant_row.table_name,
    grant_row.privilege_type
  from table_grants grant_row
  where grant_row.role_name = 'authenticated'
    and grant_row.privilege_type in ('REFERENCES', 'TRIGGER', 'TRUNCATE')

  union all

  select
    'authenticated_mutation_grant_without_policy',
    grant_row.table_name,
    grant_row.privilege_type
  from table_grants grant_row
  where grant_row.role_name = 'authenticated'
    and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and not exists (
      select 1
      from policy_commands policy_row
      where policy_row.table_name = grant_row.table_name
        and (policy_row.cmd = grant_row.privilege_type or policy_row.cmd = 'ALL')
        and ('authenticated' = any(policy_row.roles))
    )

  union all

  select
    'authenticated_policy_without_grant',
    policy_row.table_name,
    policy_row.cmd
  from policy_commands policy_row
  where policy_row.cmd in ('INSERT', 'UPDATE', 'DELETE')
    and 'authenticated' = any(policy_row.roles)
    and not exists (
      select 1
      from table_grants grant_row
      where grant_row.table_name = policy_row.table_name
        and grant_row.role_name = 'authenticated'
        and grant_row.privilege_type = policy_row.cmd
    )

  union all

  select
    'public_policy_role',
    policy_row.table_name,
    policy_row.cmd
  from policy_commands policy_row
  where 'public' = any(policy_row.roles)

  union all

  select
    'anonymous_sequence_grant',
    grant_row.object_name,
    grant_row.privilege_type
  from information_schema.role_usage_grants grant_row
  where grant_row.object_schema = 'public'
    and grant_row.grantee = 'anon'
    and grant_row.object_type = 'SEQUENCE'

  union all

  select
    'browser_public_function_execute',
    routine.routine_name,
    privilege.grantee
  from information_schema.routines routine
  join information_schema.routine_privileges privilege
    on privilege.specific_schema = routine.specific_schema
   and privilege.specific_name = routine.specific_name
  where routine.routine_schema = 'public'
    and privilege.privilege_type = 'EXECUTE'
    and privilege.grantee in ('PUBLIC', 'anon')

  union all

  select
    'unreviewed_authenticated_public_function',
    routine.routine_name,
    privilege.grantee
  from information_schema.routines routine
  join information_schema.routine_privileges privilege
    on privilege.specific_schema = routine.specific_schema
   and privilege.specific_name = routine.specific_name
  where routine.routine_schema = 'public'
    and privilege.privilege_type = 'EXECUTE'
    and privilege.grantee = 'authenticated'
    and routine.routine_name not in ('create_organization', 'read_cms_transfer_states')

  union all

  select
    'unsafe_browser_view',
    table_grant.table_name,
    coalesce(view_row.is_updatable, 'UNKNOWN')
  from information_schema.role_table_grants table_grant
  join information_schema.views view_row
    on view_row.table_schema = table_grant.table_schema
   and view_row.table_name = table_grant.table_name
  where table_grant.table_schema = 'public'
    and table_grant.grantee in ('anon', 'authenticated')
)
select check_name, object_name, detail
from violations
order by check_name, object_name, detail;
