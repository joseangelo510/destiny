import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ sendMagicLink: vi.fn() }));
import LoginPage from "./page";

describe("Rebound SEO account entry", () => {
  it("makes login explicit while preserving the requested return destination", async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ next: "/app/content?site=example" }) }));
    expect(html).toContain("Log in to Rebound SEO");
    expect(html).toContain("Your next chapter starts here.");
    expect(html).toContain('name="next"');
    expect(html).toContain("/app/content?site=example");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Use an email link instead");
    expect(html).toContain("Set or reset password");
  });
  it("keeps email confirmation distinct from a successful login", async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ sent: "1", email: "sam@example.com" }) }));
    expect(html).toContain("Check your inbox");
    expect(html).toContain("sam@example.com");
    expect(html).toContain("Open it in this browser to continue");
    expect(html).not.toContain("You are logged in");
  });
});
