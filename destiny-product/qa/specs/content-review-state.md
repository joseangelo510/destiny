# Content review state clarity

A persisted article must show a pending state while saved review decisions and quality checks load, then display the settled result. Never render an empty failure list as an in-progress check. Approval stays unavailable until hydration and quality checks complete. Connected CMS destinations use Manage CMS connection. WordPress verification failures expose their saved human-readable reason; transfer reports are explicitly historical. No publishing, verification weakening, or integration credential changes.

Validation: delayed hydration/check, pass/fail and missing reason tests; authenticated desktop/mobile content route and connected/disconnected fixtures. Preserve all existing approval and tenant-isolation tests.
