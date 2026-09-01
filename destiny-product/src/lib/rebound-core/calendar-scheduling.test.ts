import { describe, expect, it, vi } from "vitest";
import { scheduleApprovedCalendarDraft } from "./calendar-scheduling";

const input = {
  draft: { id: "draft-1", keyword: "kiln repair", title: "Kiln repair guide" },
  localDate: "2026-11-10",
  timeZone: "America/Los_Angeles",
  websiteId: "11111111-1111-4111-8111-111111111111",
};

describe("Rebound Calendar scheduling", () => {
  it("uses the existing POST with the exact approved-draft title and keyword but no draft id", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { id: "slot-2" } }), { status: 201 }));

    await expect(scheduleApprovedCalendarDraft({ ...input, fetcher })).resolves.toMatchObject({ id: "slot-2" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/content/publishing-plan");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      websiteId: input.websiteId,
      contentType: "approved_draft",
      title: "Kiln repair guide",
      focusKeyword: "kiln repair",
      scheduledFor: "2026-11-10T17:00:00.000Z",
    });
    expect(String(init.body)).not.toContain("draft-1");
  });

  it("keeps a negative UTC offset timezone-aware outside DST", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { id: "slot-3" } }), { status: 201 }));

    await scheduleApprovedCalendarDraft({ ...input, fetcher, localDate: "2026-08-25", timeZone: "Pacific/Honolulu" });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).scheduledFor).toBe("2026-08-25T19:00:00.000Z");
  });

  it("surfaces the existing API error without returning a false scheduled item", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Create a publishing plan before adding calendar content." }), { status: 409 }));

    await expect(scheduleApprovedCalendarDraft({ ...input, fetcher })).rejects.toThrow("Create a publishing plan before adding calendar content.");
  });
});
