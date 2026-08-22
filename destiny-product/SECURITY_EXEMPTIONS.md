# Security dependency exemptions

Every entry is time-boxed, must describe reachability, and must have a regression guard. An exemption expires on its review date unless a replacement or renewed evidence is committed.

| Package | Advisory | Severity | Why it cannot be patched now | Reachability and compensating control | Guard | Review by |
| --- | --- | --- | --- | --- | --- | --- |
| `image-size@1.2.1` | `CVE-2025-71329` / `GHSA-5p2g-fcmc-qvqq`; `CVE-2025-71330` / `GHSA-w3rx-r6r6-pgpr` | High | As of 2026-08-22, the registry has no `image-size@2.0.3` package even though npm audit metadata names it as the patched floor. `image-size` is transitive through `html-to-docx@1.8.0`, whose distributed bundle embeds the parser instead of loading the separate `node_modules` copy. | The only production entrypoint is `createDocxFromHtml`. Article, infographic, and re-optimization HTML renderers escape user markup, and the boundary sanitizer removes `img`, `source`, and `picture` elements before `html-to-docx` can invoke its bundled image parser. | `qa/rules/document-export-security.test.ts` fails if an image element can survive the Word-export boundary. | 2026-09-05 |

## Required follow-up

- Review the upstream `image-size` advisories and releases no later than the review date.
- Upgrade immediately when a patched version is available, rerun the Word-export regression test, and remove this exemption.
- Smoke-test the article, infographic, and re-optimization DOCX routes after any `html-to-docx` or renderer change.
