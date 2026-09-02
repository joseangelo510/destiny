import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("D10.7 agent vertical slice", () => {
  it("creates exactly three site-scoped RLS tables without delete grants", async () => {
    const files = await readdir(path.join(root, "supabase/migrations"));
    const migrationName = files.find((name) => name.endsWith("_agent_vertical_slice_v1.sql"));
    expect(migrationName).toBeTruthy();
    const sql = await readFile(path.join(root, "supabase/migrations", migrationName!), "utf8");
    for (const table of ["agent_conversations", "agent_messages", "agent_proposals"]) {
      expect(sql).toContain("create table public." + table);
      expect(sql).toContain("alter table public." + table + " enable row level security");
      expect(sql).toMatch(new RegExp("grant select, insert, update on public\\\\." + table + " to authenticated"));
      expect(sql).not.toMatch(new RegExp("grant delete on public\\\\." + table));
    }
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("organization_members");
  });

  it("keeps the agent on authorized routes and out of the five-tab navigation", async () => {
    const [shell, routes, tables] = await Promise.all([
      readFile(path.join(root, "src/components/rebound-core/rebound-core-shell.tsx"), "utf8"),
      readFile(path.join(root, "src/lib/rebound-core/routes.ts"), "utf8"),
      readFile(path.join(root, "src/lib/db/table-scope.ts"), "utf8"),
    ]);
    expect(shell).toContain("Ask Rebound");
    expect(shell).toContain("/app/agent");
    expect(routes).not.toContain("/app/agent");
    for (const table of ["agent_conversations", "agent_messages", "agent_proposals"]) expect(tables).toContain(table);
  });

  it("forbids model-reachable publishing and client imports of agent server code", async () => {
    const [registry, eslint] = await Promise.all([
      readFile(path.join(root, "src/lib/agent/tools/registry.ts"), "utf8"),
      readFile(path.join(root, "eslint.config.mjs"), "utf8"),
    ]);
    expect(registry).not.toMatch(/publish_to_cms|send_email|delete_record/);
    expect(eslint).toContain("@/lib/agent/*");
  });
});
