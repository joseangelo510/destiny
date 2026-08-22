# Privileged Edge Function boundary

Destiny treats every Edge Function that uses `context.supabaseAdmin` as a
privileged security boundary. The service role bypasses row-level security, so
request-controlled identifiers cannot authorize a privileged read or write by
themselves.

## Required boundary types

- `website_rls`: authenticate a user, derive their identity from the verified
  JWT, and prove access to the requested website through the ordinary
  `context.supabase` client before the first service-role operation.
- `account_claim`: derive the account identifier from verified user claims;
  never accept a user identifier from the request body.
- `oauth_state`: accept no authenticated browser session, but consume a
  single-use, hashed OAuth state record before storing credentials.
- `cron_secret`: reject the request unless the configured server secret and
  request header match before the first service-role operation.
- `signed_token_or_cron`: require a verified HMAC token for the unsubscribe
  branch or the cron secret for the background-delivery branch.

## Enforcement

The executable inventory must exactly match every function containing
`context.supabaseAdmin`. Adding a new service-role function without choosing a
boundary makes the unit gate fail. Structural tests verify that authorization
precedes privileged work and cover the negative authorization shape. Runtime
negative tests remain mandatory when a function's behavior cannot be proven by
the disposable database harness.

Static enforcement is not a substitute for an end-to-end authorization test.
It is the tripwire that prevents a privileged function from silently escaping
review.
