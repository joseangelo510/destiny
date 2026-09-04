import "server-only";

import { scopedClient } from "@/lib/db";
import { buildCoachTaskSet } from "@/lib/product/coach-experience";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";
import type { PanelResult, ReboundCoreWorkspace } from "./contracts";
import type { ApprovedCalendarDraft } from "./calendar-scheduling";
import { approvedCalendarDrafts, buildCalendarView, buildContentPipeline, buildDistributionView, buildProgressView } from "./core-pages";
import { empty, failed, ready } from "./panel-result";
import { buildCoreQueue } from "./queue";

type WorkspaceContext = Awaited<ReturnType<typeof getWorkspaceContext>>;
type ContentPipeline = ReturnType<typeof buildContentPipeline>;
type CalendarView = ReturnType<typeof buildCalendarView>;
type DistributionView = ReturnType<typeof buildDistributionView>;
type ProgressView = ReturnType<typeof buildProgressView>;

export type ReboundContentView = ReboundCoreWorkspace & { pipeline: PanelResult<ContentPipeline> };
export type ReboundCalendarView = ReboundCoreWorkspace & {
  approvedDrafts: PanelResult<ApprovedCalendarDraft[]>;
  calendarView: PanelResult<CalendarView>;
  planTimezone: string;
};
export type ReboundDistributionView = ReboundCoreWorkspace & { distribution: PanelResult<DistributionView> };
export type ReboundProgressView = ReboundCoreWorkspace & { progress: PanelResult<ProgressView>; reportRecipient: string | null };
export type ReboundDraftView = ReboundCoreWorkspace & {
  auditId: string;
  draft: {
    id: string;
    title: string;
    keyword: string;
    body: string;
    generationStatus: string;
    approved: boolean;
    updatedAt: string | null;
    data: Record<string, unknown>;
  };
};

async function coreWorkspace(context: WorkspaceContext): Promise<ReboundCoreWorkspace | null> {
  if (!context.website) return null;
  let queue: ReboundCoreWorkspace["queue"];
  try {
    const coach = await buildCoachTaskSet(context.quests);
    const built = buildCoreQueue(coach.window.map((quest, index) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      actionPath: quest.action_path,
      taskType: quest.task_type,
      priority: index,
      status: quest.status,
      verificationStatus: quest.verification_status,
    })));
    queue = built.items.length ? ready(built) : empty("Nothing needs you right now. Rebound SEO is watching for the next move.");
  } catch {
    queue = failed("The ranked session could not be loaded. Your existing tools remain available.");
  }
  return {
    firstName: context.profile?.first_name?.trim() || null,
    websiteLabel: context.website.business_name?.trim() || context.website.normalized_domain,
    websiteId: context.website.id,
    websites: context.websites.map((website) => ({ id: website.id, business_name: website.business_name, normalized_domain: website.normalized_domain })),
    queue,
    searchConnected: context.integrations.some((item) => item.provider === "google_search_console" && item.status === "connected"),
  };
}

async function publicationReceipts(context: WorkspaceContext) {
  if (!context.website) return [];
  const client = context.supabase as unknown as { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown }> };
  const { data } = await client.rpc("read_cms_transfer_states", { p_website_id: context.website.id });
  return Array.isArray(data) ? data : [];
}

async function latestPlanAndItems(context: WorkspaceContext) {
  if (!context.website) return { plan: null, items: [], error: true };
  const scoped = await scopedClient(context.website.id);
  const { data: plans, error: planError } = await scoped.select("publishing_plans", "id,status,timezone,start_date,end_date,updated_at").order("updated_at", { ascending: false }).limit(1);
  const plan = plans?.[0] ?? null;
  if (planError || !plan) return { plan, items: [], error: Boolean(planError) };
  const { data: items, error } = await scoped.select("publishing_schedule_items", "id,plan_id,keyword,title,scheduled_for,state,last_error,review_recommended,remote_permalink").eq("plan_id", plan.id).order("scheduled_for");
  return { plan, items: items ?? [], error: Boolean(error) };
}

function reportRecipient(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLocaleLowerCase("en-US");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export async function loadReboundContent(): Promise<ReboundContentView | null> {
  const context = await getWorkspaceContext();
  const base = await coreWorkspace(context);
  if (!base || !context.website) return null;
  try {
    const scoped = await scopedClient(context.website.id);
    const [{ data: drafts, error: draftError }, { data: approvedKeywords, error: keywordError }, schedule, receipts] = await Promise.all([
      scoped.select("article_drafts", "id,keyword,draft,updated_at").order("updated_at", { ascending: false }),
      scoped.select("keyword_preferences", "keyword,decision").eq("decision", "approved").order("keyword"),
      latestPlanAndItems(context),
      publicationReceipts(context),
    ]);
    const pipeline = draftError || keywordError || schedule.error
      ? failed<ContentPipeline>("The content pipeline could not be loaded. The existing Content Studio is still available.")
      : (drafts?.length || approvedKeywords?.length || schedule.items.length || receipts.length)
        ? ready(buildContentPipeline({ approvedKeywords: approvedKeywords ?? [], drafts: drafts ?? [], scheduleItems: schedule.items, receipts }))
        : empty<ContentPipeline>("No approved keywords, drafts, or publishing items exist yet. Start in the existing Keyword strategy tool.");
    return { ...base, pipeline };
  } catch {
    return { ...base, pipeline: failed("The content pipeline could not be loaded. The existing Content Studio is still available.") };
  }
}

export async function loadReboundDraft(draftId: string): Promise<ReboundDraftView | null> {
  const context = await getWorkspaceContext();
  const base = await coreWorkspace(context);
  if (!base || !context.website) return null;
  const scoped = await scopedClient(context.website.id);
  const { data: row, error } = await scoped.select("article_drafts", "id,audit_id,keyword,draft,updated_at").eq("id", draftId).maybeSingle();
  if (error || !row) return null;
  const saved = record(row.draft);
  const auditId = typeof row.audit_id === "string" ? row.audit_id : "";
  if (!auditId) return null;
  const keyword = typeof row.keyword === "string" ? row.keyword : String(saved.keyword ?? "");
  return {
    ...base,
    auditId,
    draft: {
      id: String(row.id),
      title: typeof saved.title === "string" && saved.title.trim() ? saved.title : keyword || "Saved draft",
      keyword,
      body: typeof saved.body === "string" ? saved.body : "This draft does not contain a saved article body yet.",
      generationStatus: typeof saved.generationStatus === "string" ? saved.generationStatus : "starter",
      approved: saved.approved === true,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
      data: saved,
    },
  };
}

export async function loadReboundCalendar(): Promise<ReboundCalendarView | null> {
  const context = await getWorkspaceContext();
  const base = await coreWorkspace(context);
  if (!base || !context.website) return null;
  try {
    const scoped = await scopedClient(context.website.id);
    const [schedule, { data: drafts, error: draftError }, { data: approvedKeywords, error: keywordError }, { data: preferences }] = await Promise.all([
      latestPlanAndItems(context),
      scoped.select("article_drafts", "id,website_id,keyword,draft,updated_at").order("updated_at", { ascending: false }),
      scoped.select("keyword_preferences", "id,keyword,updated_at").eq("decision", "approved").order("updated_at", { ascending: false }),
      scoped.select("notification_preferences", "timezone").limit(1),
    ]);
    const draftOptions = approvedCalendarDrafts(drafts ?? [], context.website.id);
    const approvedDrafts = draftError
      ? failed<ApprovedCalendarDraft[]>("Approved drafts could not be loaded for Calendar.")
      : draftOptions.length
        ? ready(draftOptions)
        : empty<ApprovedCalendarDraft[]>("No approved draft is ready to schedule yet.");
    const savedPreferenceTimeZone = typeof preferences?.[0]?.timezone === "string" && preferences[0].timezone.trim() ? preferences[0].timezone : "UTC";
    const planTimezone = typeof schedule.plan?.timezone === "string" && schedule.plan.timezone.trim() ? schedule.plan.timezone : savedPreferenceTimeZone;
    const calendarView = schedule.error || keywordError
      ? failed<CalendarView>("The saved publishing calendar could not be loaded.")
      : ready(buildCalendarView({ approvedKeywords: approvedKeywords ?? [], items: schedule.items, timeZone: planTimezone }));
    return { ...base, approvedDrafts, calendarView, planTimezone };
  } catch {
    return {
      ...base,
      approvedDrafts: failed("Approved drafts could not be loaded for Calendar."),
      calendarView: failed("The saved publishing calendar could not be loaded."),
      planTimezone: "UTC",
    };
  }
}

export async function loadReboundDistribution(): Promise<ReboundDistributionView | null> {
  const context = await getWorkspaceContext();
  const base = await coreWorkspace(context);
  if (!base || !context.website) return null;
  try {
    const provider = providerResultFromMetrics(context.metrics);
    const opportunities = list(provider.distributionOpportunities).map(record);
    const scoped = await scopedClient(context.website.id);
    const { data: interlinks, error } = await scoped.select("interlink_opportunities", "id,source_title,target_title,status,verified_at,source_url,target_url").order("created_at", { ascending: false }).limit(100);
    const built = buildDistributionView({ opportunities, interlinks: interlinks ?? [] });
    const distribution = error
      ? failed<DistributionView>("Distribution evidence could not be loaded. The existing Distribution tool is still available.")
      : built.rows.length ? ready(built) : empty<DistributionView>("No saved community opportunities or interlink evidence exists yet.");
    return { ...base, distribution };
  } catch {
    return { ...base, distribution: failed("Distribution evidence could not be loaded. The existing Distribution tool is still available.") };
  }
}

export async function loadReboundProgress(): Promise<ReboundProgressView | null> {
  const context = await getWorkspaceContext();
  const base = await coreWorkspace(context);
  if (!base || !context.website) return null;
  const recipient = reportRecipient(context.website.notification_email) ?? reportRecipient(context.profile?.contact_email);
  try {
    const [schedule, receipts] = await Promise.all([latestPlanAndItems(context), publicationReceipts(context)]);
    const built = buildProgressView({ auditId: context.audit?.id ?? null, quests: context.quests, scheduleItems: schedule.items, receipts });
    const progress = schedule.error
      ? failed<ProgressView>("The cross-workspace progress view could not be loaded.")
      : (built.done.length || built.owners.you.length || built.owners.rebound.length || built.owners.google.length)
        ? ready(built)
        : empty<ProgressView>("No saved progress exists yet. Rebound SEO will build this history from completed work and verified evidence.");
    return { ...base, progress, reportRecipient: recipient };
  } catch {
    return { ...base, progress: failed("The cross-workspace progress view could not be loaded."), reportRecipient: recipient };
  }
}
