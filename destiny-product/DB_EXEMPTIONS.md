# Database access exemptions

New product code must use `src/lib/db/`. These are the explicitly reviewed legacy, bootstrap, test, and Edge Function exceptions. Each legacy row is a ratchet target and must be removed when that surface moves behind `scopedClient`, `orgClient`, or `adminClient`.

| Path | Class | Justification |
| --- | --- | --- |
| `src/app/account/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/account/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/audits/[id]/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/audits/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/drafts/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/drafts/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/generate/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/generate/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/infographic/document/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/infographic/render/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/infographic/render/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/infographic/research/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/infographic/research/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/publishing-plan/run/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/repurpose/generate/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/repurpose/generate/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/repurpose/sources/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/repurpose/sources/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/content/word/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/content/word/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/directory-profiles/check/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/directory-profiles/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/distribution/creators/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/founder-why/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/integrations/cms/webflow/draft/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/integrations/cms/webflow/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/integrations/cms/webflow/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/integrations/cms/wordpress/draft/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/integrations/cms/wordpress/reconcile/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/integrations/cms/wordpress/reconcile/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/integrations/cms/wordpress/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/integrations/cms/wordpress/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/integrations/google/start/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/integrations/google/sync/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interlinks/opportunities/[id]/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interlinks/opportunities/[id]/verify/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interlinks/runs/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interviews/[id]/answers/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interviews/[id]/article/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interviews/[id]/complete/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interviews/[id]/insights/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/interviews/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/keywords/decisions/route.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/app/api/keywords/decisions/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/llm-visibility/tasks/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/notifications/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/onboarding/competitors/suggest/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/onboarding/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/rank-tracker/keywords/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/rank-tracker/lists/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/reoptimization-documents/[id]/download/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/reoptimization-documents/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/research/backlinks/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/research/keywords/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/api/website-profile/route.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/audits/[id]/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/auth/confirm/route.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/app/auth/signout/route.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/app/content/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/distribution/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/internal-links/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/interviews/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/keywords/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/login/actions.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/app/onboarding/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/rank-tracker/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/app/reoptimization/[id]/page.tsx` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/lib/interviews/server.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/lib/supabase/client.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/lib/supabase/proxy.test.ts` | test-harness | Test-only Supabase type or mock dependency; it cannot access production data. |
| `src/lib/supabase/proxy.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/lib/supabase/server.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `src/lib/workspace-context.ts` | legacy | Existing call site retained during the timeboxed scoped-client migration; RLS remains the primary boundary. |
| `src/proxy.ts` | bootstrap | Authentication or framework bootstrap owns session construction and cannot yet receive a website scope. |
| `supabase/functions/delete-account/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/google-oauth-callback/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/google-oauth-start/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/google-sync/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/process-audit/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/rank-digest/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/rank-tracker-refresh/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/send-welcome/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/seo-research/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/suggest-competitors/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/webflow-connect/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/webflow-draft/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/wordpress-connect/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/wordpress-draft/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
| `supabase/functions/wordpress-reconcile/index.ts` | service-role | Reviewed Edge Function boundary; authorization is enforced before privileged work and covered by negative tests. |
