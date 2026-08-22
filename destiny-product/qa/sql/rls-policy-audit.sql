with public_tables as (
  select
    class.relname as table_name,
    class.relrowsecurity as rls_enabled,
    count(policy.polname) as policy_count
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  left join pg_policy policy on policy.polrelid = class.oid
  where namespace.nspname = 'public'
    and class.relkind in ('r', 'p')
  group by class.relname, class.relrowsecurity
)
select format(
  '%s|rls=%s|policies=%s',
  table_name,
  rls_enabled,
  policy_count
)
from public_tables
where not rls_enabled
   or (policy_count = 0 and table_name <> 'cms_transfers')
order by table_name;
