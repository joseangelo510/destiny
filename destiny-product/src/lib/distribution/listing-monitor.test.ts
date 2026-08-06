import { describe, expect, it, vi } from "vitest";
import { verifyDirectoryProfile } from "./listing-monitor";

describe("verifyDirectoryProfile", () => {
  it("follows only redirects that remain on the expected directory host", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://www.yelp.com/biz/example" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(verifyDirectoryProfile("yelp", "https://yelp.com/biz/example", fetcher)).resolves.toMatchObject({ reachable: true, httpStatus: 200 });
  });

  it("blocks redirects away from the directory instead of following them", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    await expect(verifyDirectoryProfile("yelp", "https://yelp.com/biz/example", fetcher)).rejects.toThrow("unexpected host");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
