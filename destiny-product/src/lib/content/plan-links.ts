export function calendarTopicId(keyword: string) {
  return `topic-${encodeURIComponent(keyword.trim().toLowerCase().replace(/\s+/g, " "))}`;
}

export function calendarTopicHref(keyword: string, websiteId: string) {
  return `/app/calendar?site=${encodeURIComponent(websiteId)}&keyword=${encodeURIComponent(keyword)}#${calendarTopicId(keyword)}`;
}

export function startKeywordDraftHref(keyword: string, websiteId?: string) {
  return `/content?${websiteId ? `site=${encodeURIComponent(websiteId)}&` : ""}keyword=${encodeURIComponent(keyword)}#article-review-workspace`;
}
