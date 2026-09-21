export const INITIAL_KEYWORD_VISIBLE_LIMIT = 50;

export function keywordDisclosureState({
  filteredCount,
  loadedCount,
  revealed,
}: {
  filteredCount: number;
  loadedCount: number;
  revealed: boolean;
}) {
  const safeFilteredCount = Math.max(0, filteredCount);
  const safeLoadedCount = Math.max(0, loadedCount);
  const visibleCount = revealed
    ? safeFilteredCount
    : Math.min(INITIAL_KEYWORD_VISIBLE_LIMIT, safeFilteredCount);
  const hiddenCount = Math.max(0, safeFilteredCount - visibleCount);
  const buttonLabel = hiddenCount === 0
    ? null
    : hiddenCount >= INITIAL_KEYWORD_VISIBLE_LIMIT
      ? "Show 50 more keywords"
      : `Show all ${safeFilteredCount} keywords`;

  return {
    emptyMessage: safeFilteredCount > 0
      ? null
      : safeLoadedCount === 0
        ? "No keyword rows were returned for this query. This does not establish zero search demand. Try a related phrase or a broader topic."
        : "No keywords match these filters. Clear or adjust the filters to see the loaded results.",
    visibleCount,
    hiddenCount,
    buttonLabel,
    toolbarLabel: hiddenCount > 0
      ? `Showing ${visibleCount} of ${safeFilteredCount} keywords · ${safeLoadedCount} loaded`
      : `${safeFilteredCount} shown of ${safeLoadedCount} loaded`,
    caption: hiddenCount > 0 ? `Showing ${visibleCount} of ${safeLoadedCount} keywords` : null,
  };
}
