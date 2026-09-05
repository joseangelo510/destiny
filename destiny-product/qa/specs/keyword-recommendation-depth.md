# Keyword recommendation depth correction

Date: 2026-09-05 UTC. PR: https://github.com/joseangelo510/destiny/pull/108.
Status: corrective implementation prepared; not merged or deployed.

## Problem and acceptance

The v1.1.4 JAS screen offered only four narrow recommendations. Existing saved onboarding must supply recommendations without another questionnaire. Preserve the approved cream/forest tables, show 15 initial options, offer another 15 and continued research, avoid existing/duplicate topics, and preserve saved decisions and website scope. Never fabricate metrics to fill a quota.

The old discovery queried six theme seeds, chose 12 candidates before coverage rejection, and did not refill. Its UI initially showed four. The correction builds up to 24 balanced seeds from saved structured offers, customer audiences, problems, outcomes and differentiation, including offers omitted from older theme lists. It requests measured phrase and related searches, refills after coverage rejection, orders across offers, and suppresses equivalent topics within and across batches. Existing ranking quality gates remain in use.

The initial research target is 30 accepted options, displayed 15 at a time. Discover more retrieves another provider page with the same website and onboarding context, appends up to 15 additional options, and preserves previous results on provider failure. Saved decisions can trigger replenishment when fewer than 15 remain. Discovery is bounded to six provider rounds and 120 coverage checks per round; exhausted or unavailable research is represented honestly, with access to keyword research. It cannot guarantee 15 qualifying keywords for every possible business or provider outage.

## Provider evidence

Read-only JAS onboarding and saved audit context were verified in the selected production project. The actual corrected discovery code was exercised against DataForSEO using the existing runtime credentials; previously observed provider responses were reused for equivalent requests. No credentials or private onboarding payloads are included here. No customer decisions, drafts, CMS content, database configuration or deployment were changed.

Initial pool: 24 seeds, 931 measured rows, 36 coverage checks, 30 accepted, ready, zero provider errors. Continuation at offset 100: 24 seeds, 826 measured rows, 18 coverage checks, 15 accepted after excluding the initial pool, ready, zero provider errors. Monthly volumes below are provider estimates. Coverage is limited to checked saved pages and indexed search results, not a full-site crawl.

### Initial 15

| Keyword | Monthly searches |
|---|---:|
| conversion rate optimization services pricing | 30 |
| cost for seo services | 1000 |
| how much does a google ads campaign cost | 20 |
| generative engine optimization vs seo | 20 |
| youtube marketing strategy | 210 |
| google ads campaign budget | 40 |
| generative engine optimization guide | 20 |
| conversion rate optimization audit | 170 |
| google ads campaign structure | 50 |
| generative engine optimization example | 20 |
| free conversion rate optimization checklist | 10 |
| google ads campaign setup guide | 20 |
| generative engine optimization strategy | 90 |
| conversion rate optimization strategies | 170 |
| google ads campaign example | 30 |

### Additional discovery

| Keyword | Monthly searches |
|---|---:|
| how to market b2b services | 10 |
| google ads vs campaign manager 360 | 10 |
| conversion rate optimization funnel | 10 |
| generative engine optimization audit | 10 |
| youtube marketing budget | 10 |
| google ads campaign brief template | 10 |
| conversion rate optimization template | 10 |
| how to improve generative engine optimization | 10 |
| how to do affiliate marketing on youtube | 20 |
| google ads campaign status not eligible | 10 |
| how conversion rate optimization works | 10 |
| how generative engine optimization geo rewrites the rules of search | 10 |
| why is marketing youtube videos crucial for brands | 30 |
| google ads how to edit campaign | 10 |
| how to measure conversion rate optimization | 10 |

## Regression coverage

RED commit 5733222 demonstrated insufficient recommendation depth before implementation. Additional failing regressions covered provider-failure retention, feedback ordering, cross-batch pricing duplicates and replenishment after decisions. Unit tests cover bounded phrase/related research and offsets, missing structured offers, refill after coverage rejection, meaningful content angles, topic interleaving, equivalent topics, retained ordering, and recovery. Desktop/mobile browser journeys verify 15 → 30 → 31 visible rows, independence of the existing table, website-preserving continued discovery, and retained results during provider unavailability. Existing create-content draft persistence/idempotency and tenant isolation journeys remain required.

Final complete local and CI gates, exact-head staging evidence, screenshots and technical review are recorded in PR108. No release authorization or live status is implied by this document.
