import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../../supabase/migrations/20260822030000_destiny_interviews.sql", import.meta.url);
const indexMigrationUrl = new URL("../../../supabase/migrations/20260822030500_index_interview_foreign_keys.sql", import.meta.url);

describe("Rebound SEO Interviews migration", () => {
  it("enforces website-scoped RLS across every interview table", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const table of ["interviews", "interview_questions", "interview_answers", "voice_library_items"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`private.is_organization_member(organization_id)`);
    }
    expect(sql).toContain("website.id = interviews.website_id");
    expect(sql).toContain("website.id = interview_answers.website_id");
  });

  it("makes the original answer immutable at the database layer", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("new.verbatim_text is distinct from old.verbatim_text");
    expect(sql).toContain("Interview verbatim text is immutable");
    expect(sql).toContain("before update on public.interview_answers");
  });

  it("stores only a transcript in the typed MVP while reserving 30-day audio expiry", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("audio_delete_after");
    expect(sql).toContain("raw_transcript");
    expect(sql).toContain("speaker_corrected_text");
  });

  it("indexes the foreign keys used by interview lookups and cleanup", async () => {
    const sql = await readFile(indexMigrationUrl, "utf8");
    expect(sql).toContain("interviews_audit_idx");
    expect(sql).toContain("interview_answers_interview_idx");
  });
});
