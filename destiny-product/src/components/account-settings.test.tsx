import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountSettings } from "./account-settings";

const websites = [
  { id: "site-1", businessName: "Acme Admissions", normalizedDomain: "acme.example" },
  { id: "site-2", businessName: null, normalizedDomain: "new-site.example" },
];

describe("AccountSettings keyword ranking emails", () => {
  it("shows exactly three cadence choices per website with Every 3 days recommended", () => {
    const html = renderToStaticMarkup(<AccountSettings
      activeWebsiteId="site-1"
      loginEmail="login@example.com"
      notificationEmail="reports@example.com"
      rankingEmailPreferences={{ "site-1": { frequency: "three_day", unsubscribedAt: null, lastDigestSentAt: "2026-08-14T09:00:00Z", lastDigestStatus: "sent" } }}
      websites={websites}
    />);
    expect(html).toContain("Keyword ranking emails");
    expect(html.match(/Every 3 days/g)).toHaveLength(3); // heading copy + one option per website
    expect(html.match(/name="ranking-frequency-site-1"/g)).toHaveLength(3);
    expect(html.match(/Recommended/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Last sent Aug 14, 2026");
  });

  it("preserves an existing three-day choice and defaults a website without a row to Weekly", () => {
    const html = renderToStaticMarkup(<AccountSettings
      activeWebsiteId="site-1"
      loginEmail="login@example.com"
      notificationEmail={null}
      rankingEmailPreferences={{ "site-1": { frequency: "three_day", unsubscribedAt: null, lastDigestSentAt: null, lastDigestStatus: "never" } }}
      websites={websites}
    />);
    // site-1 keeps three_day checked; site-2 falls back to weekly.
    expect(html).toMatch(/name="ranking-frequency-site-1" checked="" value="three_day"/);
    expect(html).toMatch(/name="ranking-frequency-site-2" checked="" value="weekly"/);
    expect(html).toContain("No ranking email sent yet");
  });

  it("shows an unsubscribed website as Off", () => {
    const html = renderToStaticMarkup(<AccountSettings
      activeWebsiteId="site-1"
      loginEmail="login@example.com"
      notificationEmail={null}
      rankingEmailPreferences={{ "site-1": { frequency: "three_day", unsubscribedAt: "2026-08-10T00:00:00Z", lastDigestSentAt: null, lastDigestStatus: "skipped" } }}
      websites={[websites[0]]}
    />);
    expect(html).toMatch(/name="ranking-frequency-site-1" checked="" value="off"/);
  });
});
