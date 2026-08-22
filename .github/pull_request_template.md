## Outcome

<!-- What user-visible outcome or safety improvement does this change create? -->

## Specification

- Spec: `destiny-product/qa/specs/`
- Red test commit: <!-- commit SHA proving the new or changed test failed before implementation -->

## Evidence

- [ ] `pnpm gate` passes locally from `destiny-product/`
- [ ] The QA inventory is regenerated and committed
- [ ] Any applied migration is appended to the production migration ledger
- [ ] No production mutation was used for verification
- [ ] Screenshots, traces, database receipts, or provider receipts are attached when the change requires them

## Site isolation

- [ ] All reads and writes remain scoped to the authenticated organization and selected website
- [ ] A second website or tenant cannot observe or mutate this change's data
