# Jony Ive → Destiny design pass

## Product essence

Destiny is an SEO coach, not an SEO dashboard. The product should first express the coach's judgment—what matters now and why—then make the full evidence and toolset available without forcing the founder to orient themselves inside Destiny's architecture.

This pass is based on the complete Stripe Sessions transcript, the official Stripe transcript, Jony Ive's McKinsey interview, an audit of the current product, and a consultation with Claude Fable 5 at Max effort.

## Direct principles used

- Simplicity expresses a thing's essence, purpose, and role; it is not merely the removal of visible elements.
- People sense care and carelessness, including in details that are not promotional features.
- Words frame the problem and shape how people think about it.
- Function and beauty are inseparable: something that does not work is ugly.
- Easily measured attributes are only part of the truth.
- Joy and humor are meaningful, not trivial, when they serve the relationship between a person and a product.
- Designers must take responsibility for unintended consequences.

Primary references: [Stripe Sessions transcript](https://stripe.com/sessions/2025/a-conversation-with-sir-jony-ive) and [McKinsey interview](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-creative-process-is-fabulously-unpredictable-a-great-idea-cannot-be-predicted).

## Interface decisions implemented

1. **One unmistakable next step on This Week.** The next useful task, its honest time estimate, business meaning, and action now precede momentum history and the full checklist.
2. **Coaching before product architecture.** This Week, Roadmap, Strategy, and Results remain visible. Nine secondary destinations now sit inside one calm `Tools & reports` disclosure and automatically open when a person is using one of those tools.
3. **The compass is now an instrument, not wallpaper.** It remains in the audit journey and Roadmap, where direction is meaningful. It was removed from onboarding and This Week, where it duplicated clearer progress information.
4. **Roadmap begins with position and direction.** The current landmark leads. Verification methodology and momentum history are available on demand instead of competing with the map's purpose.
5. **A two-register visual hierarchy.** Warm serif display typography carries Destiny's coaching voice; a restrained system sans-serif carries records, actions, and evidence. The dominant action receives the strongest accent, secondary information is quieter, and focus states remain explicit.
6. **Care in invisible behavior.** The root layout no longer depends on downloading Google Fonts at build time. The product can build reliably in restricted or offline environments.
7. **One open instruction, not four competing ones.** Only Destiny's selected task opens by default; the remaining category tasks stay in a calm, scannable list until the founder chooses one.
8. **Mobile preserves meaning, not just layout.** Onboarding stage names remain visible, the weekly action fits above the bottom navigation, and Roadmap presents the current landmark before its compass illustration.
9. **Human quantities in Results.** Estimated visits and keyword counts display as whole people and searches rather than fractional provider values.
10. **Browser-extension tolerance.** The root hydration boundary tolerates extensions that annotate the body before React loads, preventing a false development error from covering the experience.

## Deliberate non-changes

- All onboarding questions remain unchanged.
- The truthful distinction between self-reported work and independently verified outcomes remains intact.
- SEO logic, live evidence, data connections, and Results' factual purpose are unchanged.
- Features were not removed; secondary tools remain one interaction away.
- Destiny was not restyled to resemble Apple, and Duolingo's interface, sounds, characters, or pressure mechanics were not copied.
- Claude recommended replacing `Perfect Week` and reset-style streaks with more humane accumulated records. That is a thoughtful extrapolation, not a direct Ive principle, and it conflicts with previously approved product language; it requires a separate product decision rather than being smuggled into this design pass.

## Validation

- Three-second test: can someone correctly name the screen's purpose?
- Time-to-action test: can someone identify and begin the next task without scanning statistics?
- Five-second Roadmap test: can someone answer “Where am I?” and “What is next?” before opening the explanation?
- Mobile first-screen test: are the weekly action and Roadmap action visible above the fixed navigation at a 390 × 844 viewport?
- Read-aloud test: would a human SEO coach say the interface text to a founder's face?
- Remove-it test: if a decorative element disappears, is any meaning lost?
- Care audit: review empty, loading, failure, zero-result, reported, and verified states—not only ideal screenshots.

Automated coverage in this pass verifies the coaching hierarchy, current-task selection, single-open-task behavior, progressive disclosure, truthful completion state, preserved onboarding language, human count formatting, hydration tolerance, and the absence of a decorative compass from the wrong surfaces. Runtime QA covers authenticated desktop and 390 × 844 mobile views for onboarding, This Week, Roadmap, and Results, including disclosure controls, action visibility, data-source labels, and clean browser consoles.
