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
required_service_role_privileges as (
  select
    table_row.table_name::text as object_name,
    'TABLE'::text as object_type,
    required_privilege.privilege_type::text as privilege_type
  from information_schema.tables table_row
  cross join (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) as required_privilege(privilege_type)
  where table_row.table_schema = 'public'
    and table_row.table_type = 'BASE TABLE'

  union all

  select
    sequence_row.sequence_name::text,
    'SEQUENCE'::text,
    required_privilege.privilege_type::text
  from information_schema.sequences sequence_row
  cross join (
    values ('USAGE'), ('SELECT')
  ) as required_privilege(privilege_type)
  where sequence_row.sequence_schema = 'public'
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

  union all

  select
    'service_role_missing_table_privilege',
    required_row.object_name,
    required_row.object_type || ':' || required_row.privilege_type
  from required_service_role_privileges required_row
  where (
    required_row.object_type = 'TABLE'
    and not exists (
      select 1
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = required_row.object_name
        and grant_row.grantee = 'service_role'
        and grant_row.privilege_type = required_row.privilege_type
    )
  ) or (
    required_row.object_type = 'SEQUENCE'
    and not exists (
      select 1
      from information_schema.role_usage_grants grant_row
      where grant_row.object_schema = 'public'
        and grant_row.object_name = required_row.object_name
        and grant_row.grantee = 'service_role'
        and grant_row.privilege_type = required_row.privilege_type
    )
  )

  union all

  select
    'service_role_missing_function_execute',
    routine.routine_name,
    routine.specific_name
  from information_schema.routines routine
  where routine.routine_schema = 'public'
    and not exists (
      select 1
      from information_schema.routine_privileges privilege
      where privilege.specific_schema = routine.specific_schema
        and privilege.specific_name = routine.specific_name
        and privilege.grantee = 'service_role'
        and privilege.privilege_type = 'EXECUTE'
    )

  union all

  select
    'public_grantee_grant',
    grant_row.table_name,
    'TABLE:' || grant_row.privilege_type
  from information_schema.table_privileges grant_row
  where grant_row.table_schema = 'public'
    and grant_row.grantee = 'PUBLIC'

  union all

  select
    'public_grantee_grant',
    grant_row.object_name,
    grant_row.object_type || ':' || grant_row.privilege_type
  from information_schema.role_usage_grants grant_row
  where grant_row.object_schema = 'public'
    and grant_row.object_type = 'SEQUENCE'
    and grant_row.grantee = 'PUBLIC'
)
select check_name, object_name, detail
from violations
order by check_name, object_name, detail;
