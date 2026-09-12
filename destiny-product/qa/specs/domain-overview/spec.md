# Domain Overview

Owner request: research an arbitrary public domain in a dedicated Rebound tool, with a SEMrush-style information hierarchy and DataForSEO data, then publish the feature. Scope and release authority: DEPLOY_LOG.md D10.35.

- The selected workspace remains unchanged when researching another domain.
- Explicit authenticated lookups validate workspace access, public domain and supported market before provider invocation.
- Full-index headline totals remain independent of bounded table samples. Missing values are unavailable, never fabricated zeroes.
- Present domain rank, organic/paid traffic and keywords, traffic value, live backlinks and referring domains; monthly history, ranking distribution, country/language comparisons, pages, competitors, ad samples, anchors and AI sources.
- Label DataForSEO estimates and 0-100 rank accurately; do not present them as SEMrush proprietary scores, observed analytics visits or universal AI visibility.
- Partial source failures preserve successful sections. Failed follow-up lookups preserve and identify the prior snapshot.
- Desktop and mobile support all report views, table filtering/sorting, bounded pagination and CSV export. Print exports the currently visible view.
- No schema, credentials, authentication policy or real customer records change. Existing research modes stay compatible.

Evidence: provider RED commit 718e4b7; browser and API tests; full repository gate, exact-head CI/staging and live provider lookup required before deployment completion.
