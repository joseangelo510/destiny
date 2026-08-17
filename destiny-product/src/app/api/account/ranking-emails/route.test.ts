import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, update, eq, select, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

import { PATCH } from "./route";

const WEBSITE_ID = "11111111-1111-4111-8111-111111111111";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/account/ranking-emails", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/account/ranking-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { update, eq, select, maybeSingle };
    update.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    select.mockReturnValue(chain);
    maybeSingle.mockResolvedValue({
      data: {
        website_id: WEBSITE_ID,
        ranking_digest_frequency: "three_day",
        next_digest_at: "2026-08-19T09:00:00Z",
        last_digest_sent_at: "2026-08-14T09:00:00Z",
        last_digest_status: "sent",
        unsubscribed_at: null,
      },
      error: null,
    });
    from.mockReturnValue(chain);
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "login@example.com" } }, error: null });
  });

  it("saves the cadence scoped to the selected website only", async () => {
    const response = await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "three_day" }));

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("notification_preferences");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ranking_digest_frequency: "three_day" }));
    expect(eq).toHaveBeenCalledWith("website_id", WEBSITE_ID);
    const payload = await response.json();
    expect(payload.frequency).toBe("three_day");
    expect(payload.lastDigestStatus).toBe("sent");
  });

  it("schedules the next digest when enabling and clears the unsubscribe marker", async () => {
    await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "weekly" }));

    const updated = update.mock.calls[0][0];
    expect(updated.unsubscribed_at).toBeNull();
    expect(typeof updated.next_digest_at).toBe("string");
    expect(new Date(updated.next_digest_at).getTime() - new Date(updated.updated_at).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("turns scheduling off and records the unsubscribe when the user chooses Off", async () => {
    await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "off" }));

    const updated = update.mock.calls[0][0];
    expect(updated.ranking_digest_frequency).toBe("off");
    expect(updated.next_digest_at).toBeNull();
    expect(typeof updated.unsubscribed_at).toBe("string");
  });

  it("rejects unknown cadences", async () => {
    const response = await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "daily" }));

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("requires a website id", async () => {
    const response = await PATCH(patchRequest({ frequency: "weekly" }));

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "weekly" }));

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 404 when the website is not in the user's organization", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await PATCH(patchRequest({ websiteId: WEBSITE_ID, frequency: "weekly" }));

    expect(response.status).toBe(404);
  });
});
