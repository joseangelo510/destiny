import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, invoke, signOut } = vi.hoisted(() => ({
  getUser: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, signOut }, functions: { invoke } }),
}));

import { DELETE } from "./route";

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "login@example.com" } }, error: null });
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    signOut.mockResolvedValue({ error: null });
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
