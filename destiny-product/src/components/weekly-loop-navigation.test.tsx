import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WeeklyLoop } from "./weekly-loop";
import { WorkspaceWebsiteProvider } from "./workspace-link";

it("opens audit details in the same website as the weekly plan", () => {
  const websiteId = "11111111-1111-4111-8111-111111111111";
  const html = renderToStaticMarkup(<WorkspaceWebsiteProvider websiteId={websiteId}>
    <WeeklyLoop auditId="saved-audit" currentStreak={0} groups={[]} remainingTasks={0} />
  </WorkspaceWebsiteProvider>);
  expect(html).toContain(`href="/audits/saved-audit?site=${websiteId}"`);
});
