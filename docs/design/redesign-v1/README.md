# Rebound SEO redesign v1 specification

These files are the implementation specification for the parallel Rebound SEO core experience:

- `rebound-notes-v5.html`: Home, fixed and pixel-faithful.
- `rebound-five-pillars.html`: shell, Content, article review, Calendar, Distribution, and Progress.
- `PLAN.md`: phased implementation and governance contract.

Content is the final six-column truthful-state pipeline: Ideas, Drafts, Approved, Scheduled, Published, and Verified live. The rejected Keywords-table variant and all earlier concepts are reference only and are intentionally absent from this directory.

The pottery values inside the HTML files are documentation examples, not product fixtures. These files must remain under `docs/`, must never be served or imported by application code, and must never provide production data.

Gate 0 discovery and the active claim boundary are recorded in `DISCOVERY.md`. The MEDIUM Slice 1 keeps governance re-pin material out of this product PR.

## Slice 1 visual acceptance evidence

The reference and implementation screenshots are paired at the exact acceptance viewports. The implementation images use the disposable, website-scoped browser fixture and intentionally show honest disconnected states instead of the mockup's example metrics.

| Viewport | Fable reference | Slice 1 implementation |
|---|---|---|
| 1360 × 1000 | [Home reference](screenshots/home-reference-desktop-1360x1000.png) | [Home actual](screenshots/home-actual-desktop-1360x1000.png) |
| 390 × 844 | [Home reference](screenshots/home-reference-mobile-390x844.png) | [Home actual](screenshots/home-actual-mobile-390x844.png) |
