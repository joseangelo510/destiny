-- Hosted Supabase projects can carry broad browser-role default privileges.
-- Rebuild the public-schema ACL from the reviewed RLS policy surface so a
-- policy and its table privilege can never silently drift apart.

-- Destiny has no anonymous workspace-data path. Policies created without an
-- explicit role defaulted to PUBLIC; tighten those policies before deriving
-- authenticated privileges from them.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and 'public' = any(roles)
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

-- Remove every inherited table, view, and sequence privilege first. Service
-- role grants are intentionally untouched.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Re-grant only policy-backed CRUD commands. SELECT is also a dependency for
-- RETURNING and filtered UPDATE/DELETE statements, so any reviewed CRUD policy
-- receives SELECT privilege while RLS still controls row visibility.
do $$
declare
  grant_row record;
begin
  for grant_row in
    select
      tablename,
      bool_or(cmd in ('SELECT', 'ALL')) as allow_select,
      bool_or(cmd in ('INSERT', 'ALL')) as allow_insert,
      bool_or(cmd in ('UPDATE', 'ALL')) as allow_update,
      bool_or(cmd in ('DELETE', 'ALL')) as allow_delete
    from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any(roles)
    group by tablename
  loop
    execute format('grant select on table public.%I to authenticated', grant_row.tablename);
    if grant_row.allow_insert then
      execute format('grant insert on table public.%I to authenticated', grant_row.tablename);
    end if;
    if grant_row.allow_update then
      execute format('grant update on table public.%I to authenticated', grant_row.tablename);
    end if;
    if grant_row.allow_delete then
      execute format('grant delete on table public.%I to authenticated', grant_row.tablename);
    end if;
  end loop;
end;
$$;

-- Serial sequences are not currently used, but future policy-backed INSERT
-- tables may own one. Restore only the sequence dependency for those tables.
do $$
declare
  sequence_row record;
begin
  for sequence_row in
    select distinct sequence_namespace.nspname as schema_name, sequence_class.relname as sequence_name
    from pg_class sequence_class
    join pg_namespace sequence_namespace on sequence_namespace.oid = sequence_class.relnamespace
    join pg_depend dependency on dependency.objid = sequence_class.oid
      and dependency.deptype in ('a', 'i')
    join pg_class table_class on table_class.oid = dependency.refobjid
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    where sequence_class.relkind = 'S'
      and sequence_namespace.nspname = 'public'
      and table_namespace.nspname = 'public'
      and exists (
        select 1
        from pg_policies policy_row
        where policy_row.schemaname = 'public'
          and policy_row.tablename = table_class.relname
          and 'authenticated' = any(policy_row.roles)
          and policy_row.cmd in ('INSERT', 'ALL')
      )
  loop
    execute format(
      'grant usage, select on sequence %I.%I to authenticated',
      sequence_row.schema_name,
      sequence_row.sequence_name
    );
  end loop;
end;
$$;

-- These are the only browser-callable public RPCs. Worker RPCs retain their
-- existing service_role grants because service_role was not revoked above.
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.read_cms_transfer_states(uuid) to authenticated;

-- Close the inheritance path for objects created by the migration owner.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
