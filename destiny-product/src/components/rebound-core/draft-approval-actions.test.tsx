import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DraftApprovalActions } from "./draft-approval-actions";

const props = {
  auditId: "11111111-1111-4111-8111-111111111111",
  draft: {
    keyword: "kiln repair",
    title: "Kiln repair guide",
    body: "Saved body",
    generationStatus: "generated",
    approved: false,
  },
  websiteId: "831740e7-b8f7-4612-8fe4-794219031191",
};

describe("DraftApprovalActions", () => {
  it("renders the honest editable-workspace path without claiming an edit request", () => {
    const html = renderToStaticMarkup(<DraftApprovalActions {...props} />);

    expect(html).toContain("Edit in Content Studio");
    expect(html).toContain("/content?site=831740e7-b8f7-4612-8fe4-794219031191#article-review-workspace");
    expect(html).not.toContain("Request edits");
  });

  it("renders reopen as the available action for an approved draft", () => {
    const html = renderToStaticMarkup(<DraftApprovalActions {...props} draft={{ ...props.draft, approved: true }} />);

    expect(html).toContain("Reopen this draft");
  });
});
