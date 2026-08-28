# Truthful offline publishing lifecycle

The mandatory harness runs the production article preparation and publication
verification logic against reserved `.invalid` destinations. It must never call
a client CMS or public network.

## WordPress acceptance path

1. An approved, generated article is transformed through Destiny's production
   WordPress preparation contract.
2. A future publication time produces `scheduled`, an external receipt, and no
   public URL.
3. A public-page check that lacks canonical, content, indexability, or required
   media proof produces `verification_failed` and still no public URL.
4. Only complete public proof produces `verified_live` and records the verified
   permalink.
5. Every transition records a stable job identifier and timestamp so background
   work is observable.
6. A website cannot reconcile another website's transfer receipt.

Webflow remains a draft-only handoff in this harness. Wix remains an explicitly
manual handoff. Neither is represented as directly published.

## Public artifact proof

`pnpm qa:public-artifacts <manifest.json>` performs an unauthenticated public
fetch. A manifest must name the exact website, exact public post URL, expected
hostname, and at least one unique content marker. WordPress proof also requires
the expected canonical URL. Homepages, LinkedIn share intents, X compose
intents, and Facebook share dialogs are rejected because they are actions, not
published artifacts.

Social sharing in the Destiny UI currently opens the platform's share composer.
That is a manual handoff, not an automatic publisher. It may be reported as
`publicly_verified` only after the user supplies the final LinkedIn, X, or
Facebook post URL and the unauthenticated verifier can retrieve the expected
content. A platform login wall or bot challenge remains unverified.
