# Replit production recovery snapshot

- Captured: 2026-08-14
- Replit app: Destiny SEO
- Replit source commit: `fafc3a7fc31c0c777e531cb56bf216e42ec34b1c`
- Archive: `destiny-replit-recovery-fafc3a7.tgz`
- Archive SHA-256: `67d06e06f10155c3a2a9e22b0b39f014a041a465067f8978e5f2992c86eb71f7`
- Archive size: 806,936 bytes
- Tracked files: 411

The archive was generated from the tracked tree in Replit. It excludes Git metadata, dependencies, build outputs, caches, runtime environment files, credentials, and prior recovery archives. Replit verified that its file list matched the tracked tree at the source commit.

This recovery branch imports that snapshot on top of the latest GitHub `main` branch. GitHub-only recovery infrastructure is intentionally retained: the CI workflow, port manifests, and the saved-draft hydration regression coverage. Those files do not alter the captured Replit application behavior.

## Verification

- Archive checksum matched after download.
- Archive paths were checked for absolute paths and parent-directory traversal before extraction.
- Dependency lockfile passed the package supply-chain policy check.
- ESLint passed.
- Vitest passed: 109 files and 557 tests.
- Next.js production build passed: 43 static pages and 56 total application routes inventoried.
- Browser tests require a configured Supabase environment and will run against the disposable staging branch before release.
