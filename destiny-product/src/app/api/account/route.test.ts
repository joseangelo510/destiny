import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, invoke, signOut, from, update, eq, select, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signOut }, functions: { invoke }, from }),
}));

import { DELETE, PATCH } from "./route";

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { update, eq, select, maybeSingle };
    update.mockReturnValue(chain);
    eq.mockReturnValue(chain);
    select.mockReturnValue(chain);
    maybeSingle.mockResolvedValue({ data: { notification_email: "reports@example.com" }, error: null });
    from.mockReturnValue(chain);
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "login@example.com" } }, error: null });
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("updates the notification recipient only for the selected website", async () => {
    const response = await PATCH(new Request("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({
        notificationEmail: " Reports@Example.com ",
        websiteId: "11111111-1111-4111-8111-111111111111",
      }),
    }));

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("websites");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ notification_email: "reports@example.com" }));
    expect(eq).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
    await expect(response.json()).resolves.toEqual({ notificationEmail: "reports@example.com" });
  });

  it("does not allow an account-wide email update without a selected website", async () => {
    const response = await PATCH(new Request("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ notificationEmail: "reports@example.com" }),
    }));

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("requires the current login email as confirmation", async () => {
    const response = await DELETE(new Request("http://localhost/api/account", { method: "DELETE", body: JSON.stringify({ confirmation: "wrong@example.com" }) }));

    expect(response.status).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("deletes through the authenticated server boundary and clears the local session", async () => {
    const response = await DELETE(new Request("http://localhost/api/account", { method: "DELETE", body: JSON.stringify({ confirmation: "LOGIN@example.com" }) }));

    expect(response.status).toBe(200);
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: { confirmation: "login@example.com" } });
    expect(signOut).toHaveBeenCalled();
  });
});
