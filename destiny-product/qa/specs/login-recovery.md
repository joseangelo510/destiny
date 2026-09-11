# Sign-in cooldown recovery

D10.27; base 95ecbd4921b80a688b3aee74b796d8a744259b93. Provider accepted Gmail OTP at 02:59:47 UTC September 11, then rejected repeated requests with over_email_send_rate_limit. Gmail placed the legitimate message in Spam. Generic UI incorrectly implied an unexplained send failure.

Acceptance: pending submit is disabled; typed 429 response shows safe cooldown guidance and a bounded countdown without claiming a send; email and validated internal destination survive success and failure; successful confirmation exposes a delayed resend, spam guidance and a separate-account explanation; each server outcome resets the presentation timer. Provider throttling and verification are authoritative; URL state never grants access. Preserve registration behavior, session exchange, customer memberships and all website data.

Regression evidence: actions.test.ts RED three failures before implementation; GREEN typed cooldown, success return path, generic failure redaction and external destination fallback. Desktop/mobile login-recovery.spec.ts verifies countdown release and switch-email destination preservation. Existing full harness verifies authenticated site isolation and core tools.

Gmail operational recovery: one test request accepted, newest message moved from Spam to Inbox via Report not spam, actual magic link opened existing ClearCheck Coach and full workspace. No workspace changes or account merges. This recipient correction is not proof of universal inbox delivery.
