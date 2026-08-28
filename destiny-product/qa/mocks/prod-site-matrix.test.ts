import { describe, expect, it } from "vitest";
import { parseProductionSiteMatrix } from "../support/prod-site-matrix";

describe("production site matrix", () => {
  it("parses three exact websites without blending ids or names", () => {
    const rows = parseProductionSiteMatrix(JSON.stringify([
      { websiteId: "clearcheck-id", businessName: "ClearCheck", auditId: "clearcheck-audit" },
      { websiteId: "jas-id", businessName: "Jose Angelo Studios", auditId: "jas-audit" },
      { websiteId: "junkit-id", businessName: "98 Junkit", auditId: "junkit-audit" },
    ]));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.websiteId)).size).toBe(3);
    expect(new Set(rows.map((row) => row.auditId)).size).toBe(3);
  });

  it("rejects duplicate website ids and incomplete records", () => {
    expect(() => parseProductionSiteMatrix(JSON.stringify([
      { websiteId: "same", businessName: "ClearCheck", auditId: "audit-a" },
      { websiteId: "same", businessName: "98 Junkit", auditId: "audit-b" },
    ]))).toThrow(/duplicate website id/i);
    expect(() => parseProductionSiteMatrix(JSON.stringify([
      { websiteId: "clearcheck-id", businessName: "", auditId: "clearcheck-audit" },
    ]))).toThrow(/businessName/i);
  });
});
