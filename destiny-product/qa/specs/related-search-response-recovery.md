# Related-search response recovery

The Google Advanced SERP documented response supplies related_searches.items as strings. Both keyword research and reoptimization parsers previously traversed objects only, discarding documented strings. Parse strings and retain supported title/keyword objects within items. Do not return container titles, URLs or unrelated SERP strings as keywords.

Acceptance: documented strings reach related suggestions; mixed string/object inputs clean and deduplicate; retain at most12unique suggestions; absent data remains empty; questions/organic evidence, seed, market and timestamp remain intact. Existing Research this and Save controls consume these suggestions. Do not invent search volume, copy a variant's metrics, add provider calls or change billing/security.

Evidence: official https://docs.dataforseo.com/v3/serp-se-type-live-advanced/ and acceptance166synthetic reproduction. Live163–165 showed empty related surfaces but underlying provider payloads were not captured, so their specific cause remains unconfirmed. RED Edge3fail/1pass; separate serverRED1fail. FocusedGREEN28/28 across both parsers, components and API tests. Full gate/staging/review pending. Edge deployment is separate; no claim of live repair.
