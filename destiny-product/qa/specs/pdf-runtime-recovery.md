# PDF extraction after production bundling

A readable PDF uploaded to Repurpose must produce source text when the application runs from a production Next webpack build. Direct-library tests alone cannot establish this promise.

The live acceptance test returned a missing `.next/server/chunks/pdf.worker.mjs` error for a valid one-page PDF. The runtime regression builds a disposable Next application importing the unchanged production parser and posts a synthetic text-layer PDF to its loopback-only route. It must return HTTP 200 and the known text. It has no production authentication, database, provider or credentials; persistence and the authenticated upload route remain separate acceptance checks.

RED: commit 803ae0d reproduces HTTP 422 and the same missing-worker error. GREEN resolves the installed server worker through a native Node module lookup and assigns it explicitly. It preserves package versions, file caps, complexity limits, encryption and site isolation. The regression is included in the normal Vitest suite.

Validation requires the runtime regression and all existing parser rejection tests, followed by the complete repository harness and a real candidate upload. An 11 MiB upload failing before parsing is a separate transport issue; this repair does not claim to resolve it. Production is unchanged until the protected release process completes.
