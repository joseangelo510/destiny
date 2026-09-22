# Preserve inline graphic text

Inline SVG output must preserve the full title, insight, every item and source label. Wrap at word boundaries, break oversized unbroken tokens without dropping characters, preserve XML escaping and expand vertical space based on line counts. Never fix layout by clipping factual content. Existing consumers continue importing renderInfographicSvg from article-generation. No provider or CMS mutation.

Test exact63-character live examples, long headings/sources, ninth item, escaping, long tokens and browser bounding boxes. Full validation and visual inspection required before release.
