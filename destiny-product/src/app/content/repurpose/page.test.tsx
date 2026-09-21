import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), editor: vi.fn(), calls: [] as Array<{ table: string; fields?: string; filters: Record<string, unknown>; range?: number[] }>, rows: [] as Array<Record<string, unknown>>, error: false }));
vi.mock("@/lib/workspace-context", () => ({ getWorkspaceContext: mocks.context }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/repurpose-workspace", () => ({ RepurposeWorkspace: (props: unknown) => { mocks.editor(props); return <div>Editor</div>; } }));
vi.mock("@/lib/content/article-generation", () => ({ articleGenerationCapability: () => ({ available: false }) }));
import RepurposePage from "./page";

const websiteId = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const row = { id: sourceId, website_id: websiteId, draft_title: "Saved FAQ", draft_body: "Exact saved answer.\n\nSecond paragraph.", output_type: "faq", source_name: "Notes.txt", source_url: null, updated_at: "2026-09-21T12:00:00Z", target_keyword: "background checks" };

beforeEach(() => {
  mocks.calls.length = 0; mocks.rows = [row]; mocks.error = false; mocks.editor.mockClear();
  mocks.context.mockResolvedValue({ website: { id: websiteId, normalized_domain: "fixture.example" }, supabase: { from(table: string) {
    const call: typeof mocks.calls[number] = { table, filters: {} }; mocks.calls.push(call);
    const result = () => ({ data: table === "keyword_preferences" ? [] : mocks.rows.filter(r => Object.entries(call.filters).every(([k, v]) => r[k] === v)), error: mocks.error && table === "repurpose_sources" ? { message: "private database detail" } : null });
    const query = {
      select(fields: string) { call.fields = fields; return query; },
      eq(key: string, value: unknown) { call.filters[key] = value; return query; },
      not() { return query; }, order() { return query; },
      range(from: number, to: number) { call.range = [from, to]; return query; },
      maybeSingle() { const value = result(); return Promise.resolve({ ...value, data: value.data[0] ?? null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
    }; return query;
  } } });
});

async function render(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await RepurposePage({ searchParams: Promise.resolve(params) }));
}

it("lists saved drafts with a selected-site reopening link without loading all bodies", async () => {
  const html = await render();
  expect(html).toContain("Saved FAQ");
  expect(html).toContain(`source=${sourceId}`);
  expect(html).toContain(`site=${websiteId}`);
  const reads = mocks.calls.filter(c => c.table === "repurpose_sources");
  expect(reads).toHaveLength(1);
  expect(reads[0].filters.website_id).toBe(websiteId);
  expect(reads[0].fields).not.toMatch(/draft_body|ciphertext/);
  expect(mocks.editor.mock.calls[0][0].initialDraft).toBeUndefined();
});

it("reopens the exact saved text, output, attribution and keyword without requiring generation", async () => {
  await render({ source: sourceId });
  expect(mocks.editor.mock.calls[0][0].initialDraft).toMatchObject({ title: row.draft_title, bodyMarkdown: row.draft_body, output: "faq", sourceId, sourceAttribution: "Notes.txt", targetKeyword: "background checks" });
  expect(mocks.editor.mock.calls[0][0].generationAvailable).toBe(false);
  const selected = mocks.calls.find(c => c.filters.id === sourceId);
  expect(selected?.filters.website_id).toBe(websiteId);
  expect(selected?.fields).not.toContain("ciphertext");
});

it("does not reopen a draft belonging to a different selected website", async () => {
  mocks.rows = [{ ...row, website_id: "00000000-0000-4000-8000-000000000003" }];
  expect(await render({ source: sourceId })).toContain("Draft not found for this website");
  expect(mocks.editor.mock.calls[0][0].initialDraft).toBeUndefined();
});

it("handles malformed source IDs without sending them to the database", async () => {
  expect(await render({ source: "invalid" })).toContain("Draft not found for this website");
  expect(mocks.calls.some(c => c.filters.id)).toBe(false);
});

it("reports a load failure without claiming the saved library is empty", async () => {
  mocks.error = true;
  const html = await render();
  expect(html).toContain("Saved drafts could not be loaded");
  expect(html).not.toContain("private database detail");
  expect(html).not.toContain("No saved drafts yet");
});

it("allows older saved drafts to be reached while keeping the site in pagination links", async () => {
  mocks.rows = Array.from({ length: 21 }, (_, i) => ({ ...row, id: `${sourceId.slice(0, -2)}${String(i).padStart(2, "0")}` }));
  const html = await render({ draftsPage: "2" });
  expect(mocks.calls.find(c => c.table === "repurpose_sources")?.range).toEqual([20, 40]);
  expect(html).toContain("Older drafts");
  expect(html).toContain("Newer drafts");
  expect(html).toContain("draftsPage=3");
  expect(html).toContain(`site=${websiteId}`);
});
