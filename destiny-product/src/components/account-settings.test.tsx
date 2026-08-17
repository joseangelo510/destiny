import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountSettings } from "./account-settings";

describe("AccountSettings", () => {
  it("makes the login and notification identities explicit", () => {
    const html = renderToStaticMarkup(<AccountSettings activeWebsiteId="11111111-1111-4111-8111-111111111111" loginEmail="login@example.com" notificationEmail="reports@example.com" websites={[
      { id: "11111111-1111-4111-8111-111111111111", businessName: "Example Co", normalizedDomain: "example.com", rankingDigestFrequency: "three_day", lastDigestSentAt: "2026-08-16T16:00:00.000Z" },
      { id: "22222222-2222-4222-8222-222222222222", businessName: "Second Co", normalizedDomain: "second.example", rankingDigestFrequency: "weekly", lastDigestSentAt: null },
    ]} />);

    expect(html).toContain("login@example.com");
    expect(html).toContain("reports@example.com");
    expect(html).toContain("Login email");
    expect(html).toContain("Audit and contact email");
    expect(html).toContain("Each website can use a different address");
    expect(html).toContain("Your websites");
    expect(html).toContain("Example Co");
    expect(html).toContain("example.com");
    expect(html).toContain("Second Co");
    expect(html).toContain("second.example");
    expect(html).toContain("Current website");
    expect(html.match(/Delete website/g)).toHaveLength(2);
    expect(html).toContain("Deleting a website does not delete your Destiny account");
    expect(html).toContain("Save notification email");
    expect(html).toContain("Keyword ranking emails");
    expect(html).toContain("Every 3 days");
    expect(html).toContain("Recommended");
    expect(html).toContain("Weekly");
    expect(html).toContain("Off");
    expect(html).toContain("Last sent");
    expect(html).toContain('type="email"');
    expect(html).toContain("Delete account");
    expect(html).toContain("cannot be undone");
  });
});
