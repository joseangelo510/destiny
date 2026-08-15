# ClearCheck onboarding and publishing QA — 2026-08-14

## Scope

- Website: `https://clearcheck.app/`
- Destiny website record: `99a7af37-6588-4b97-a848-8877760182a9`
- Authenticated owner: `joseangelo85@gmail.com`
- WordPress administrator verified: `jose@joseangelostudios.com`
- Content scope: net-new SEO content only; no re-optimization

## Evidence collected

| Check | Status | Evidence |
| --- | --- | --- |
| Public website | PASS | Homepage, `robots.txt`, sitemap, and WordPress REST API return HTTP 200. |
| CMS type | PASS | WordPress with Divi Child Theme and AIOSEO Pro. |
| Existing content inventory | PASS | Public API returned 53 posts and 48 pages; the blog category currently contains 51 posts. |
| Destiny tenant selection | PASS | The authenticated owner can open the ClearCheck workspace; an orphaned ClearCheck record is not accessible through the active account. |
| WordPress admin identity | PASS | Active admin session is `jose@joseangelostudios.com`. |
| WordPress application passwords | PASS | A separate revocable `Destiny ClearCheck Publishing 2026-08-14` credential was created without exposing the normal WordPress password. |
| Destiny CMS connection | PASS | Integration `867d3d49-7045-4116-9fa6-e872bac049e2` is connected to `https://clearcheck.app` with post read/write and media-write scopes. |
| LinkedIn personal identity | PASS | Connected account resolves to Jose Angelo Gallegos. |
| LinkedIn company access | BLOCKED | Organization lookup returns HTTP 403 because the connection lacks `r_organization_admin`; the ClearCheck company page cannot be verified or used yet. |
| X account access | PARTIAL | Chrome is authenticated as the official `@clearcheckapp` account and can publish manually. The external connector cannot create an OAuth connection because its auth configuration is missing. |
| Keyword provider | PASS | Live domain report returned 724 provider keywords and current ranking-page data. |
| Keyword strategy quality | FAIL | The strategy recommends competitor/navigational phrases such as Accenture, Truework, NTT Data, and Republic Services. The sole approved keyword is `clear view risk` with zero volume. |
| Existing-page detection | FAIL | The strategy says many phrases have no page after inspecting only the homepage, despite 101 public post/page URLs. This can produce duplicate or cannibalizing content. |
| Content Studio queue | PASS | Production now shows only the three vetted approved phrases: `background check fcra compliance`, `adverse action background check`, and `ban the box laws`. The former Accenture item is no longer in the active three-article queue. |
| Logout | FAIL | Signing out redirects to `https://0.0.0.0:3000/` instead of the production homepage/login flow. |
| Research-to-strategy handoff | PASS | The tested `Add to strategy` flow is live. It preserves provider intent, monthly volume, and difficulty, starts strategy rank tracking, and lets Content Studio use approved research phrases that were not in the original audit pool. |
| First WordPress draft | PASS | Post `20208951`, **FCRA-Compliant Background Checks: Employer Guide**, is a WordPress draft with 2,018 rendered words, 13 H2s, 14 H3s, primary government sources, a 143-character meta description, no raw Markdown headings, and Blog as its only category. |
| Second WordPress draft | PASS | Post `20208953`, **Adverse Action Background Checks: Employer Guide**, is a WordPress draft with 2,038 rendered words, primary government sources, a legal-information disclaimer, corrected SEO metadata, and Blog as its only category. |
| Third WordPress draft | PASS | Post `20208955`, **Ban-the-Box Laws: A Practical Employer Compliance Guide**, is a WordPress draft with 2,249 rendered words, 11 H2s, 3 H3s, 32 links, government-only legal sources, no raw Markdown headings, and Blog as its only category. |
| WordPress category mapping | FAIL | Destiny-created drafts defaulted to Uncategorized and did not select Blog. The category was corrected manually on all three drafts. The transfer should resolve and send the existing `blog` category automatically. |
| WordPress graphics transfer | FAIL | Destiny generated three original SVG concepts for each article, but the WordPress transfer inserted zero images and set no featured image. The article body and metadata transferred; media did not. |
| WordPress safety state | PASS | All three posts remain `draft`; nothing was published. Titles, body HTML, excerpts/meta descriptions, and editor links round-tripped successfully. |

## Vetted net-new content candidates

These candidates were researched live through DataForSEO and checked against the current post/page inventory.

1. **FCRA-Compliant Background Checks: Employer Requirements and Provider Checklist**
   - Primary cluster: `background check FCRA compliance`
   - Provider signal: 1,300 monthly searches, transactional intent, difficulty 18
   - Supporting cluster: `FCRA compliant background check provider` (480), `FCRA compliant background check companies` (210), `FCRA background check requirements` (50)
2. **Adverse Action Background Checks: A Step-by-Step Employer Process**
   - Primary cluster: `adverse action background check`
   - Provider signal: 170 monthly searches, transactional intent
   - Supporting cluster: `pre adverse action background check` (90), `what does adverse action mean on a background check` (70), `adverse action process background check` (20)
3. **Ban-the-Box Laws by State: What Employers Need to Know**
   - Primary cluster: `ban the box laws`
   - Provider signal: 880 monthly searches, informational intent, difficulty 22
   - Supporting cluster: `ban the box laws by state` (170), `states with ban the box laws` (170)

All three require authoritative legal sourcing, a clear not-legal-advice disclosure, and review before publication.

The three phrases are now saved as approved website preferences with their live provider evidence and added to weekly rank tracking. The former zero-value phrase `clear view risk` is retained as declined feedback rather than deleted.

## WordPress draft receipts

- `https://clearcheck.app/wp-admin/post.php?post=20208951&action=edit`
- `https://clearcheck.app/wp-admin/post.php?post=20208953&action=edit`
- `https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit`

No public article URL exists yet because all three posts remain drafts. LinkedIn and X distribution must wait until a reviewed article is intentionally published.

## Connection and publishing acceptance test

1. Create a new revocable WordPress Application Password named for Destiny.
2. Connect it to the active ClearCheck website record in Destiny.
3. Generate one vetted article and verify title, slug, heading structure, citations, disclosure, internal links, CTA, excerpt/meta description, image alt text, and category.
4. Approve it in Destiny and transfer it to WordPress as a draft.
5. Verify the WordPress draft roundtrip, Divi desktop/mobile rendering, AIOSEO fields, canonical, and noindex state before publication.
6. Publish only after final content review; verify live HTTP 200, blog index placement, sitemap inclusion, canonical, and social preview.
7. Reconnect LinkedIn with company-admin scope and select `ClearCheck` explicitly.
8. Connect `@clearcheckapp` on X; verify the handle before any post is sent.
9. Draft one platform-native social post per channel, approve, publish, and verify the resulting URLs.
10. Repeat for three consecutive articles with no P0/P1 issue before considering the workflow launch-ready.

## Rollback

- Wrong WordPress destination or formatting: return the post to draft and record the transfer ID.
- Wrong social account or copy: capture the URL/screenshot, delete the post, and record the incident.
- Wrong tenant data: stop all publishing and social work until website ownership and row isolation are re-verified.
