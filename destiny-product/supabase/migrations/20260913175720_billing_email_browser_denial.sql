-- Explicit deny policy keeps the reviewed boundary visible even if grants change later.
-- Browser grants remain revoked; only the service role can use this attempt ledger.
create policy billing_email_attempts_browser_denied on public.billing_email_attempts
  for all to anon,authenticated using(false) with check(false);
