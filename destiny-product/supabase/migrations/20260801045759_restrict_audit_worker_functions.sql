-- Supabase's API grants can explicitly include anon and authenticated for new
-- public functions, so revoke those roles in addition to PUBLIC.
revoke all on function public.begin_destiny_audit(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.finalize_destiny_audit(uuid, uuid, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_destiny_audit(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.begin_destiny_audit(uuid, uuid, text) to service_role;
grant execute on function public.finalize_destiny_audit(uuid, uuid, jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.fail_destiny_audit(uuid, uuid, text) to service_role;
