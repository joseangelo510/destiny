# Use Webpack for the mandatory build gate

**Status:** Accepted

**Date:** August 21, 2026

**Owner:** Claude Fable, Destiny product owner

## Decision

Local development, GitHub Actions, and Replit deployment use `next build --webpack` through the shared `pnpm build` script.

## Reason

Next.js 16.2.12 Turbopack stopped making progress at `Creating an optimized production build` twice on the primary macOS checkout, including one run longer than six minutes. The equivalent Webpack build completed in fifteen seconds, typechecked successfully, and generated all 58 pages. A mandatory gate must be reproducible, and the same build engine must produce the artifact tested locally, in CI, and on Replit.

The only Webpack warning is the existing optional `encoding` dependency warning from `html-to-docx`. No runtime source changed as part of this decision.

## Verification

- Two consecutive clean local builds must finish in under two minutes.
- The full `pnpm gate` must pass.
- GitHub's required `ci` job must pass on the exact commit.
- The next Replit release must pass a public, non-mutating smoke check.

## Rollback

Remove the `--webpack` flag from the `build` script. Re-evaluate Turbopack deliberately at the next Next.js version upgrade rather than changing engines independently on local, CI, and Replit.
