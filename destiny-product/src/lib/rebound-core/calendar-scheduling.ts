import { calendarLocalDateTimeAsUtc } from "@/lib/content/publishing-plan";

export type ApprovedCalendarDraft = {
  id: string;
  keyword: string;
  title: string;
};

type SavedCalendarItem = Record<string, unknown> & { id: string };

export async function scheduleApprovedCalendarDraft({
  draft,
  fetcher = fetch,
  localDate,
  timeZone,
  websiteId,
}: {
  draft: ApprovedCalendarDraft;
  fetcher?: typeof fetch;
  localDate: string;
  timeZone: string;
  websiteId: string;
}): Promise<SavedCalendarItem> {
  const scheduledFor = calendarLocalDateTimeAsUtc(`${localDate}T09:00`, timeZone);
  const response = await fetcher("/api/content/publishing-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      websiteId,
      contentType: "approved_draft",
      title: draft.title,
      focusKeyword: draft.keyword,
      scheduledFor,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; item?: SavedCalendarItem };
  if (!response.ok || !payload.item?.id) {
    throw new Error(payload.error || "Rebound SEO could not schedule this approved draft.");
  }
  return payload.item;
}
