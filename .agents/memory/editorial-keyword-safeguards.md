---
name: Editorial keyword safeguards
description: How automatic editorial-calendar exclusion rules must be scoped to avoid over-filtering
---

Automatic keyword exclusion heuristics (branded modifiers, "free" terms, national scope) must be tightly gated or they suppress legitimate niche keywords.

**Why:** A first pass excluded any keyword containing an unknown token alongside an offer term as a "likely brand" — code review showed this drops valid niche modifiers like "hoarder junk removal". The fix: only treat unknown modifiers as brands on navigational (brand-finding) intent queries.

**How to apply:** When extending `automaticCalendarExclusionReason` in the editorial calendar module, keep each rule anchored to a decisive signal (competitor list match, explicit intent, evidence text) — never "token I don't recognise". Explicit user approvals must always bypass all automatic safeguards.
