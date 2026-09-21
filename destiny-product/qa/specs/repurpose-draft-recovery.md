# Reopen saved Repurpose drafts

A user can leave and reopen an existing saved Repurpose draft from the selected website. Show its saved title, exact body, output format, attribution and target keyword without generating again or consuming credits. Offer a paginated saved-draft list and a separate new-source action. Every link preserves the selected site. Do not fetch encrypted source text to list or edit drafts.

Use the existing authenticated Supabase client and uploader RLS, plus explicit website filters. A missing, malformed or other-site source ID must not expose a draft or silently select another. A database failure must display a load error, not an empty-library claim. Every persisted draft remains reachable through pagination.

RED: six page tests fail before implementation; existing production save/reload acceptance artifacts reproduce the missing reopening flow. GREEN: unchanged tests, existing Repurpose save/parser suites, full harness/isolation, exact-head candidate browser save/leave/reopen and cross-account denial. No provider call needed for loading or editing saved work. Existing save/generation endpoints and database rules remain unchanged.
