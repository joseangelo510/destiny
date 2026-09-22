# Reviews request recovery

Save, Check and Remove must clear busy state after rejected fetch or non-JSON response, show an actionable retry message and preserve input and prior profile. A successful retry performs the existing intended UI transition. Ordinary structured API errors retain their existing messages. No optimistic success, endpoint/billing/auth/schema changes or production profile mutation.

Supplemental repository-root qa/browser/reviews-recovery.spec.ts exercises all three operations, two transport failure modes and desktop/mobile with intercepted responses. No real directory writes. Existing live validation260 passes invalid URL and wrong-directory checks. Full hosted gates and exact-head review required before release.
