---
name: Supabase column-scoped grants on websites
description: New websites columns need an explicit column-level UPDATE grant or authenticated saves silently fail
---

Rule: `public.websites` (and possibly other tables) uses **column-scoped** `grant update (...)` to `authenticated` instead of table-wide grants. Any migration adding a user-editable column must also add `grant update (<column>) on public.websites to authenticated;`.

**Why:** RLS passes but the column-level privilege check rejects the update for normal users — the API save fails even though the policy allows the row. Caught in code review of the Connections builder_profile feature (Aug 2026).

**How to apply:** When adding columns intended to be written via the browser/API with the anon/authenticated client, grep `grant update` in `supabase/migrations/` and mirror the pattern in the same migration. Migrations are not applied from this workspace (no service credentials); the owner applies them to the Supabase project.
