---
name: Editorial keyword safeguards
description: How automatic editorial-calendar exclusion rules must be scoped to avoid over- and under-filtering
---

Automatic keyword exclusion heuristics (branded modifiers, "free" terms, national scope) must be anchored to decisive evidence, not provider metadata.

**Why:** Two production lessons from the junk-removal regression set: (1) provider intent labels are unreliable — brand searches like "loadup junk removal" arrive as *informational*, so gating brand exclusion on navigational intent misses real brands; (2) substring matching is unsafe for "free" services — "free junk removal" is a prefix of the evidenced "free junk removal estimate", so exact-phrase evidence must be token-level with a boundary check (phrase ends at text end or a connective word).

A third lesson: server-side vetting is not enough — the article workspace rehydrates drafts from browser localStorage, and matching saved drafts to fallbacks **by index** let stale drafts from an unvetted keyword set resurface excluded phrases. Client-persisted state must be matched by keyword and discarded when its keyword is no longer in the vetted set.

**How to apply:** In `automaticCalendarExclusionReason`, brand detection uses an allowlist of legitimate service modifiers plus strategic-page location evidence — never intent labels. Free-service keywords require the exact free phrase evidenced (free estimates ≠ free service). Explicit user approvals always bypass all automatic safeguards.
