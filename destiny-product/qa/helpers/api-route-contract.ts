import { expect, vi } from "vitest";

export function jsonRequest(pathname: string, method: string, body: unknown) {
  return new Request(`http://localhost${pathname}`, {
    method,
    body: JSON.stringify(body),
  });
}

export async function expectJsonError(response: Response, status: number, error: string) {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
}

export async function mockUnauthenticatedSupabase() {
  vi.resetModules();
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: { getClaims: async () => ({ data: { claims: null } }) },
    }),
  }));
}
