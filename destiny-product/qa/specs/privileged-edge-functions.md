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

## Billing boundaries (September 12, 2026; local implementation)

`billing` derives owner identity from verified claims, verifies the email on the server, and ignores browser-owned customer or price identifiers. Account-wide locks serialize payment operations. `billing-webhook` uses raw-body Stripe signature verification with timestamp tolerance and test/live validation before any service-role query. Customer ownership comes from the server-created billing account mapping; event metadata cannot select an owner. It refreshes current Stripe state under a lease and saves the state and event receipt atomically. Negative authorization coverage includes invalid signatures/modes, absent claims, stale or missing leases, and competing current subscriptions. These are prepared boundaries, not production deployment evidence.

Research quota rollout is partial and local: `seo-research` derives the account from verified claims and reserves keywordSearches for keywords/keyword_serp or domainReports for domain_overview/backlinks. The handler-level negative test asserts that denied allowances make zero provider calls across all four paths. Trusted worker settlement restores failed units; browser callers cannot settle/refund reservations. Creator discovery and article evidence still require integration into their respective bounded workflows before release. No production enforcement claim is made for this partial rollout.

`billing-usage` additionally requires a server HMAC covering the destination, timestamp and exact request body. Its authenticated owner comes from verified claims. Signed-in browser requests cannot reserve/refund through this worker endpoint. Finishing a reservation verifies ledger ownership and uses service-only idempotent settlement. Article generation reserves one article before research/writing and signs its evidence subrequest; evidence checks the same owner's recent reserved article. Worker secret configuration remains pending; no production enablement yet.

Onboarding suggestion billing derives ownerId only from verified user claims before service-role reservation. It accepts no caller-selected owner. Two free attempts are enforced atomically; later attempts use paid keywordSearches. Anonymous runtime denial and a forged-owner unit request cover this boundary.

The billing website_access read action checks website and organization visibility through the caller RLS client before reading the owner account through the admin client. It returns exactly canRunPaidWork and canManageBilling; no owner identifier or payment details. It does not require Stripe configuration or invoke a provider. Real local Edge coverage verifies owner/member/outsider access, unpaid transitions, private account RLS and immediate membership revocation using the same signed JWT. Payment mutation actions retain their separate verified-owner boundary.

Tracked activation also has a database boundary: private.enforce_tracking_capacity() is a trigger-only SECURITY DEFINER function with empty search_path and no browser/PUBLIC EXECUTE. It validates auth.uid membership before private owner billing reads, locks the owner account and pools enabled targets across owner websites. Unpaid or over-capacity activation remains saved as paused; explicit pause and existing-target read/update paths stay available. It does not grant new table privileges or bypass the outer write RLS. Current service_role and internal postgres fixture writes are trusted callers, but still receive the same quota enforcement. Separate worker reservations continue to enforce paid state, cadence, receipt budgets and downgrade capacity at execution time.
