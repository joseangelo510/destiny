# Rebound SEO cutover receipt

Decision IDs: `D9.2-CUTOVER-VERIFY-AND-CAMINO-RETIRE` and
`D9.3-SENDER-MIGRATION-REBOUND`

Decision source:
https://claude.ai/chat/7a177580-0665-4136-be13-08e0943fa12b

Execution date: 2026-08-29

Verification snapshot: 2026-08-29T20:00:34Z

Status: EXECUTED — AWAITING PROTECTED EVIDENCE PR CHECKS AND MERGE.

This receipt contains no secret values, authentication links, OAuth state,
authorization codes, or tokens.

## Outcome

Rebound SEO is the live product identity at `https://app.reboundseo.com`.
The root `https://reboundseo.com` marketing site remains on GoDaddy Website
Builder. Authentication email sends as `Rebound SEO <auth@reboundseo.com>`.
The four authorized Camino application-only entries were removed after Jose's
explicit action-time confirmation. Camino mail and Resend records, Rebound
root records, and Replit were preserved.

## Protected release chain

| Item | Evidence |
| --- | --- |
| D9.1 policy PR | [PR #57](https://github.com/joseangelo510/destiny/pull/57), merge `9d14897ff954998d084ede79c69e38e808a0981e` |
| PR #57 final policy guard | [run 33264684291](https://github.com/joseangelo510/destiny/actions/runs/33264684291) |
| PR #57 final checklist guard | [run 33264684328](https://github.com/joseangelo510/destiny/actions/runs/33264684328) |
| PR #57 harness | [run 33264427852](https://github.com/joseangelo510/destiny/actions/runs/33264427852) |
| PR #57 final staging | [run 33264684301](https://github.com/joseangelo510/destiny/actions/runs/33264684301) |
| Rebrand PR | [PR #58](https://github.com/joseangelo510/destiny/pull/58), merge and release SHA `fbd738c6508c9cde75231dea60acebe842eb0b6f` |
| PR #58 final policy guard | [run 33265428995](https://github.com/joseangelo510/destiny/actions/runs/33265428995) |
| PR #58 final checklist guard | [run 33265428948](https://github.com/joseangelo510/destiny/actions/runs/33265428948) |
| PR #58 harness | [run 33265149517](https://github.com/joseangelo510/destiny/actions/runs/33265149517) |
| PR #58 final staging | [run 33265429030](https://github.com/joseangelo510/destiny/actions/runs/33265429030) |
| Release-wrapper PR | [PR #61](https://github.com/joseangelo510/destiny/pull/61), merge `54564d3ec339d2f3c78e594e1551709ee15602a9` |
| PR #61 final policy guard | [run 33267862115](https://github.com/joseangelo510/destiny/actions/runs/33267862115) |
| PR #61 final checklist guard | [run 33267862099](https://github.com/joseangelo510/destiny/actions/runs/33267862099) |
| PR #61 harness | [run 33267544168](https://github.com/joseangelo510/destiny/actions/runs/33267544168) |
| PR #61 final staging | [run 33267862104](https://github.com/joseangelo510/destiny/actions/runs/33267862104) |
| Exact-main harness | [run 33267977156](https://github.com/joseangelo510/destiny/actions/runs/33267977156) at `54564d3ec339d2f3c78e594e1551709ee15602a9` |
| Immutable release tag | `rebound-seo-v1.0.0`, annotated tag object `49e95b929e23dfea9d19e5cd5177f21acf3090d1`, target `fbd738c6508c9cde75231dea60acebe842eb0b6f` |
| Production dispatch | [run 33268238022](https://github.com/joseangelo510/destiny/actions/runs/33268238022), [job 99142007848](https://github.com/joseangelo510/destiny/actions/runs/33268238022/job/99142007848), success |

The immutable deployment verified the release tag and SHA, matched the build
stamp, preserved the one-machine Fly topology, and swept all 80 committed
inventory entries: 31 HTTP 200, 48 HTTP 401, one HTTP 405, and zero HTTP 5xx.
Both `/login` inventory entries returned HTTP 200.

## Product identity and runtime

- `https://app.reboundseo.com/login` returned HTTP 200 and rendered the
  `Rebound SEO` brand with `Welcome to Rebound SEO`.
- `https://app.reboundseo.com/` returned HTTP 200 and rendered the complete
  Rebound SEO homepage and navigation.
- `https://reboundseo.com/` returned HTTP 200.
- Fly machine `860714be531938` was Started with checks `1/1` in `sjc`.
- Fly's certificate list contained only `app.reboundseo.com`, source `Fly`,
  status `Issued`, after the Camino retirement.

## Rebound DNS and root preservation

Authoritative GoDaddy checks against `ns15.domaincontrol.com` returned:

- `app.reboundseo.com A 66.241.125.157`.
- `_acme-challenge.app.reboundseo.com CNAME
  app.reboundseo.com.o9nmy2r.flydns.net.`.
- Root Website Builder A records `76.223.105.230` and `13.248.243.5`.
- Root MX records `0 smtp.secureserver.net.` and
  `10 mailstore1.secureserver.net.`.
- Root SPF `v=spf1 include:spf.em.secureserver.net ?all`.
- Resend DKIM at `resend._domainkey.reboundseo.com`.
- Resend bounce MX at `send.reboundseo.com` with priority 10.
- Resend SPF at `send.reboundseo.com`.

No Rebound root A, MX, or SPF record was changed during the app cutover or
sender migration.

## Authentication sender and journeys

- Resend showed both `reboundseo.com` and `caminoseo.com` as verified.
- Supabase custom SMTP remained enabled through `smtp.resend.com` on port 465.
- Sender identity was `Rebound SEO <auth@reboundseo.com>`.
- Magic-link subject was `Your Rebound SEO sign-in link`; the body and CTA
  were Rebound-branded.
- Fresh Resend email `0cdedc64-dee4-429d-b1f3-fbdf167a13e1` reached
  `delivered` from the Rebound sender. The message showed mailed-by
  `send.reboundseo.com`, signed-by `reboundseo.com`, valid DMARC, and Standard
  TLS.
- The fresh magic link completed on `https://app.reboundseo.com/this-week`.
  Supabase auth logs recorded `/verify` HTTP 303 followed by `/token` HTTP 200,
  provider `magiclink`, with a Rebound referer.
- Google Search Console OAuth returned to
  `https://app.reboundseo.com/integrations` with `google=connected` and
  `provider=google_search_console`. The integration UI confirmed the account
  was securely saved for the selected website. No first data sync was run.
- Supabase Edge Function `google-oauth-callback` deployment version 11 logged
  HTTP 302 at `2026-08-29T19:45:44.411Z`; the granted scope was exactly
  `https://www.googleapis.com/auth/webmasters.readonly`.

## Camino retirement

Pre-deletion snapshot:

1. Fly certificate `app.caminoseo.com`, source `Fly`, status `Issued`.
2. GoDaddy A record `app.caminoseo.com -> 66.241.125.157`, TTL 600.
3. GoDaddy CNAME `_acme-challenge.app.caminoseo.com ->
   app.caminoseo.com.o9nmy2r.flydns.net.`, TTL 3600.
4. Supabase redirect `https://app.caminoseo.com/**`.

Jose gave explicit action-time confirmation immediately before deletion. The
four entries above were then removed, and no other Camino item was selected.

Post-removal checks:

- Fly certificate inventory contained zero `app.caminoseo.com` entries.
- GoDaddy saved-record inventory contained neither the Camino `app` A record
  nor its ACME CNAME.
- The authoritative Camino zone at `ns49.domaincontrol.com` returned no A
  answer for `app.caminoseo.com` and no CNAME answer for
  `_acme-challenge.app.caminoseo.com`.
- The local resolver, Cloudflare `1.1.1.1`, Google `8.8.8.8`, and the
  authoritative Camino nameserver all returned no A answer for
  `app.caminoseo.com`; `curl` failed at DNS resolution and returned HTTP 000.
- Supabase redirect inventory contained exactly Replit and Rebound; Camino was
  absent. Supabase Site URL remained `https://app.reboundseo.com`.

## Preserved Camino and Replit state

The authoritative Camino zone still returned all mail records that were out of
deletion scope:

- `_dmarc.caminoseo.com` DMARC TXT.
- `resend._domainkey.caminoseo.com` Resend DKIM TXT.
- `send.caminoseo.com` MX priority 10 to
  `feedback-smtp.us-east-1.amazonses.com.`.
- `send.caminoseo.com` Resend SPF TXT.

Resend continued to show `caminoseo.com` as verified. Replit was not opened,
edited, deployed, decommissioned, or redirected. Its Supabase allowlist entry
`https://destiny-seo.replit.app/**` remained present.

## Rollback packet

If rollback becomes necessary under a new authorized execution:

1. Recreate the Fly certificate for `app.caminoseo.com`.
2. Restore GoDaddy A `app -> 66.241.125.157`, TTL 600.
3. Restore GoDaddy CNAME `_acme-challenge.app ->
   app.caminoseo.com.o9nmy2r.flydns.net.`, TTL 3600.
4. Restore Supabase redirect `https://app.caminoseo.com/**`.
5. Reverify Camino TLS and auth without changing Rebound, mail, or Replit.

No rollback trigger was observed.

## PR boundary

This evidence PR is docs-only. It changes no product code, workflow, policy,
dependency, schema, migration, secret, provider configuration, deployment,
traffic, or live service. It must remain draft and unmerged under the current
user instruction. No label is applied by Codex; only `joseangelo510` may apply
`cto-approved`.
