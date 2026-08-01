# Destiny LOGOS rules

This is the deterministic LOGICAFFEINE component of Destiny. It receives eight
integer signals from an SEO audit:

1. audit complete (`0` or `1`)
2. critical technical issues
3. technical warnings
4. ranking keywords
5. new keywords
6. lost keywords
7. content gaps
8. Google review count

It returns six lines: growth stage, stable decision code, weekly quest, quest
category, urgency, and a customer-facing explanation.

```bash
../.tools/logicaffeine/largo check
../.tools/logicaffeine/largo run --interpret -- 1 3 7 40 4 0 8 30
../.tools/logicaffeine/largo emit wasm
```

The emitted WebAssembly module is copied to
`../destiny-product/public/logic/destiny-logic-engine.wasm` and executed in the
customer’s browser. LOGOS is not responsible for accounts, data storage, API
integrations, background jobs, or hosting.
