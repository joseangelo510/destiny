import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountSettings } from "./account-settings";

describe("AccountSettings", () => {
  it("makes the login and notification identities explicit", () => {
    const html = renderToStaticMarkup(<AccountSettings loginEmail="login@example.com" notificationEmail="reports@example.com" />);

    expect(html).toContain("login@example.com");
    expect(html).toContain("reports@example.com");
    expect(html).toContain("Login email");
    expect(html).toContain("Audit and contact email");
    expect(html).toContain("Save notification email");
    expect(html).toContain('type="email"');
    expect(html).toContain("Delete account");
    expect(html).toContain("cannot be undone");
  });
});
