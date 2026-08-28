import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getClaims,
  invoke,
  from,
  currentArticleQualityIssues,
  prepareWordPressDraft,
  sharpToBuffer,
} = vi.hoisted(() => ({
  getClaims: vi.fn(),
  invoke: vi.fn(),
  from: vi.fn(),
  currentArticleQualityIssues: vi.fn(),
  prepareWordPressDraft: vi.fn(),
  sharpToBuffer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, functions: { invoke }, from }),
}));
vi.mock("@/lib/content/article-draft", () => ({ currentArticleQualityIssues }));
vi.mock("@/lib/cms/wordpress-draft", () => ({ prepareWordPressDraft }));
vi.mock("sharp", () => ({
  default: vi.fn(() => ({ webp: vi.fn(() => ({ toBuffer: sharpToBuffer })) })),
}));

import { POST } from "./route";

const websiteId = "11111111-1111-4111-8111-111111111111";
const plan = {
  id: "plan-1",
  audit_id: "audit-1",
  mode: "batch_schedule",
  status: "active",
  holdback_hours: 72,
  confirmed_post_count: 1,
};
const scheduleItem = {
  id: "item-1",
  plan_id: plan.id,
  position: 1,
  keyword: "background check services",
  title: "How to Compare Background Check Services",
  content_type: "SEO article",
  related_article_title: null,
  scheduled_for: "2026-09-01T16:00:00.000Z",
  state: "planned",
  review_recommended: false,
  remote_id: null,
  remote_edit_url: null,
  remote_permalink: null,
  last_error: null,
};
const draft = {
  keyword: scheduleItem.keyword,
  draft: { keyword: scheduleItem.keyword, generationStatus: "generated", approved: true },
};

function request() {
  return new Request("http://localhost/api/content/publishing-plan/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteId }),
  });
}

async function runAndReadPayload() {
  const response = await POST(request());
  return { response, payload: await response.json() };
}

function configureDatabase(options: { accessiblePlan?: boolean } = {}) {
  const accessiblePlan = options.accessiblePlan ?? true;
  const updates: Array<Record<string, unknown>> = [];
  let scheduleRead = 0;

  from.mockImplementation((table: string) => {
    if (table === "publishing_plans") {
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: accessiblePlan ? plan : null, error: null }),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      return builder;
    }
    if (table === "article_drafts") {
      const builder = { select: vi.fn(), eq: vi.fn() } as Record<string, ReturnType<typeof vi.fn>>;
      builder.select.mockReturnValue(builder);
      builder.eq
        .mockReturnValueOnce(builder)
        .mockResolvedValueOnce({ data: [draft], error: null });
      return builder;
    }
    if (table === "publishing_schedule_items") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [scheduleItem], error: null }) })),
            order: vi.fn().mockImplementation(async () => {
              scheduleRead += 1;
              return { data: [scheduleItem], error: null };
            }),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn(async () => {
            updates.push(payload);
            return { error: null };
          }),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { updates, scheduleRead: () => scheduleRead };
}

describe("POST /api/content/publishing-plan/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    currentArticleQualityIssues.mockResolvedValue([]);
    sharpToBuffer.mockResolvedValue(Buffer.from("offline-image"));
    prepareWordPressDraft.mockReturnValue({
      websiteId,
      articleKey: "audit-1:background check services",
      title: scheduleItem.title,
      contentHtml: "<p>Complete article</p>",
      scheduledFor: scheduleItem.scheduled_for,
      featuredGraphic: { name: "featured", svg: "<svg></svg>", alt: "Featured image", role: "featured", caption: "", placementAfterHeading: "" },
      graphics: [],
    });
  });

  it("rejects an anonymous job before reading a publishing plan", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("cannot run a publishing plan hidden by website RLS", async () => {
    configureDatabase({ accessiblePlan: false });
    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("records scheduled only after WordPress confirms a future post", async () => {
    const database = configureDatabase();
    invoke.mockResolvedValue({
      data: {
        delivered: true,
        publicationStatus: "scheduled",
        remoteEditUrl: "https://wordpress.qa.invalid/wp-admin/post.php?post=42&action=edit",
      },
      error: null,
    });

    const { response, payload } = await runAndReadPayload();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ checked: 1, scheduled: 1 });
    expect(database.updates).toContainEqual(expect.objectContaining({
      state: "scheduled",
      remote_id: "42",
      remote_edit_url: "https://wordpress.qa.invalid/wp-admin/post.php?post=42&action=edit",
    }));
  });

  it("records failure when the CMS returns a draft instead of a schedule", async () => {
    const database = configureDatabase();
    invoke.mockResolvedValue({
      data: {
        delivered: true,
        publicationStatus: "delivered_draft",
        remoteEditUrl: "https://wordpress.qa.invalid/wp-admin/post.php?post=43&action=edit",
      },
      error: null,
    });

    const { response, payload } = await runAndReadPayload();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ checked: 1, scheduled: 0 });
    expect(database.updates).toContainEqual(expect.objectContaining({
      state: "failed",
      last_error: "WordPress did not confirm the future publication date.",
    }));
    expect(database.updates).not.toContainEqual(expect.objectContaining({ state: "scheduled" }));
  });
});
