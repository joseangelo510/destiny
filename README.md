# Destiny

Destiny is an SEO coaching product for founders, entrepreneurs, and small-business owners. Its primary business-logic engine is written in LOGOS and compiled to WebAssembly.

This repository is shared publicly as a case study so the LOGOS team and community can inspect the implementation, architecture, testing, and migration approach.

## LOGOS implementation

- `destiny-logic-engine/src/main.lg` — LOGOS rules engine
- `destiny-product/docs/logos-primary-boundary.md` — what LOGOS owns
- `destiny-product/docs/logos-migration-safety.md` — testing and rollback approach
- `destiny-product/src/lib/logicaffeine.test.ts` — browser/server WebAssembly parity tests

## Copyright and use

Copyright © 2026 Jose Angel Gallegos. Destiny and this repository are owned by Jose Angelo Studios LLC. All rights reserved.

This repository is public for evaluation and case-study purposes. No permission is granted to copy, redistribute, modify, or commercially use the source code without prior written authorization.
