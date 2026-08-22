import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_SCOPED_TABLES,
  RELATION_SCOPED_TABLES,
  SERVICE_ROLE_ONLY_TABLES,
  SITE_SCOPED_TABLES,
  USER_SCOPED_TABLES,
} from "@/lib/db/table-scope";

const root = process.cwd();

describe("typed database access boundary", () => {
  it("turns the checked database census into a complete type map", async () => {
    const inventory = JSON.parse(await readFile(path.join(root, "qa/inventory/database-rls.json"), "utf8")) as Array<{
      table: string;
      scope: string;
      access: string;
    }>;
    const classified = new Set([
      ...SITE_SCOPED_TABLES,
      ...RELATION_SCOPED_TABLES,
      ...ORGANIZATION_SCOPED_TABLES,
      ...USER_SCOPED_TABLES,
      ...SERVICE_ROLE_ONLY_TABLES,
    ]);

    expect(classified.size).toBe(inventory.length);
    expect([...classified].sort()).toEqual(inventory.map((row) => row.table).sort());
    expect(SERVICE_ROLE_ONLY_TABLES).toEqual(["cms_transfers"]);
    expect(RELATION_SCOPED_TABLES).toEqual(["audit_metrics"]);
  });

  it("moves the highest-blast-radius publishing surfaces onto the scoped client", async () => {
    const criticalRoutes = [
      "src/app/api/content/publishing-plan/route.ts",
      "src/app/api/content/publishing-plan/run/route.ts",
      "src/app/api/integrations/cms/wordpress/draft/route.ts",
    ];
    for (const relativePath of criticalRoutes) {
      const source = await readFile(path.join(root, relativePath), "utf8");
      expect(source, relativePath).toContain("@/lib/db");
      expect(source, relativePath).not.toContain("@/lib/supabase/server");
      expect(source, relativePath).not.toContain("@supabase/supabase-js");
    }
  });

  it("keeps every remaining raw-client exception visible and justified", async () => {
    const exemptions = await readFile(path.join(root, "DB_EXEMPTIONS.md"), "utf8");
    expect(exemptions).toContain("| Path | Class | Justification |");
    expect(exemptions).toContain("legacy");
    expect(exemptions).toContain("service-role");
    expect(exemptions).not.toMatch(/\|\s*`[^`]+`\s*\|\s*[^|]+\|\s*\|/);

    const eslintConfig = await readFile(path.join(root, "eslint.config.mjs"), "utf8");
    expect(eslintConfig).toContain("no-restricted-imports");
    expect(eslintConfig).toContain("DB_EXEMPTIONS.md");
  });
});
