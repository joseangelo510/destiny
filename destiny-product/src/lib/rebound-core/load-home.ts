import "server-only";

import { buildAnalyticsPeriods, buildRankMovers } from "@/lib/analytics/dashboard";
import { scopedClient } from "@/lib/db";
import { buildCoachTaskSet } from "@/lib/product/coach-experience";
import { getWorkspaceContext, record } from "@/lib/workspace-context";
import type {
  AnalyticsSummary,
  CalendarEvent,
  CalendarSummary,
  CompetitorSummary,
  KeywordSummary,
  ReboundHomeView,
  SearchConsoleSummary,
} from "./contracts";
import { empty, failed, notConnected, ready } from "./panel-result";
import { buildCoreQueue } from "./queue";

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integrationMetadata(context: Awaited<ReturnType<typeof getWorkspaceContext>>, provider: string) {
  const integration = context.integrations.find((item) => item.provider === provider && item.status === "connected");
  return { integration, metadata: integration ? record(integration.metadata) : null };
}

function averagePositions(metadata: Record<string, unknown> | null) {
  if (!metadata) return { current: null, previous: null };
  const period = record(record(metadata.periods)["30"]);
  return {
    current: finiteNumber(period.averagePosition ?? period.avgPosition ?? metadata.averagePosition ?? metadata.avgPosition),
    previous: finiteNumber(period.previousAveragePosition ?? period.previousAvgPosition ?? metadata.previousAveragePosition),
  };
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function calendarTone(state: string): CalendarEvent["tone"] {
  if (state === "verified_live") return "verified";
  if (state === "managed_externally" || state === "published") return "automatic";
  return "move";
}

export async function loadReboundHome(): Promise<ReboundHomeView | null> {
  const context = await getWorkspaceContext();
  if (!context.website) return null;

  let queue: ReboundHomeView["queue"];
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
    queue = built.items.length ? ready(built) : empty("Nothing needs you right now. Rebound SEO will surface the next evidence-backed move here.");
  } catch {
    queue = failed("The ranked session could not be loaded. Your existing tools are still available below.");
  }

  const [{ data: tracked, error: trackedError }, { data: observations, error: observationError }] = await Promise.all([
    context.supabase.from("tracked_keywords").select("id,keyword,status").eq("website_id", context.website.id).order("created_at"),
    context.supabase.from("rank_observations").select("tracked_keyword_id,observed_at,found,position").eq("website_id", context.website.id).order("observed_at", { ascending: false }).limit(2000),
  ]);
  const activeTracked = (tracked ?? []).filter((row) => row.status !== "paused");
  const movers = buildRankMovers(activeTracked, observations ?? [], Math.max(activeTracked.length, 5));

  const searchConnection = integrationMetadata(context, "google_search_console");
  const analyticsConnection = integrationMetadata(context, "google_analytics");
  const periods = buildAnalyticsPeriods({
    searchConsole: searchConnection.metadata,
    analytics: analyticsConnection.metadata,
    movers,
  });
  const period = periods[30];
  const position = averagePositions(searchConnection.metadata);
  const searchData: SearchConsoleSummary = {
    impressions: period.metrics.impressions.total,
    impressionsChange: period.metrics.impressions.changePercent,
    clicks: period.metrics.clicks.total,
    clicksChange: period.metrics.clicks.changePercent,
    averagePosition: position.current,
    previousAveragePosition: position.previous,
    series: period.metrics.impressions.current,
    syncedAt: searchConnection.integration?.last_synced_at ?? null,
  };
  const hasSearchData = searchData.impressions !== null || searchData.clicks !== null || searchData.series.length > 0;
  const searchConsole = !searchConnection.integration
    ? notConnected<SearchConsoleSummary>("Connect Google Search Console to see verified search visibility.")
    : hasSearchData
      ? ready(searchData, [{ kind: "verified", source: "gsc", observedAt: searchData.syncedAt, detail: "Google Search Console" }])
      : empty<SearchConsoleSummary>("Search Console is connected and waiting for its first synced reporting period.");

  const analyticsData: AnalyticsSummary = {
    engagedVisits: period.metrics.engagedVisits.total,
    engagedVisitsChange: period.metrics.engagedVisits.changePercent,
    syncedAt: analyticsConnection.integration?.last_synced_at ?? null,
  };
  const analytics = !analyticsConnection.integration
    ? notConnected<AnalyticsSummary>("Analytics shows what visitors did after finding you. Connect Google Analytics from the existing Connections tool.")
    : analyticsData.engagedVisits === null
      ? empty<AnalyticsSummary>("Google Analytics is connected and waiting for its first organic-visit summary.")
      : ready(analyticsData, [{ kind: "verified", source: "ga4", observedAt: analyticsData.syncedAt, detail: "Google Analytics" }]);

  let keywords: ReboundHomeView["keywords"];
  if (trackedError || observationError) {
    keywords = failed("Tracked keyword evidence could not be loaded.");
  } else if (!activeTracked.length) {
    keywords = empty("No active tracked keywords yet. Approve a strategy or add a keyword in the existing tools.");
  } else {
    const latestByKeyword = new Map<string, { found: boolean; position: number | null }>();
    for (const observation of observations ?? []) {
      if (!latestByKeyword.has(observation.tracked_keyword_id)) latestByKeyword.set(observation.tracked_keyword_id, observation);
    }
    const positions = activeTracked.flatMap((keyword) => {
      const latest = latestByKeyword.get(keyword.id);
      return latest?.found && latest.position !== null ? [latest.position] : [];
    });
    const count = (min: number, max: number) => positions.filter((value) => value >= min && value <= max).length;
    const data: KeywordSummary = {
      tracked: activeTracked.length,
      newlyFound: movers.filter((item) => item.tone === "new" && item.currentPosition !== null).length,
      improved: movers.filter((item) => item.tone === "up").length,
      declined: movers.filter((item) => item.tone === "down" && item.currentPosition !== null).length,
      lost: movers.filter((item) => item.tone === "down" && item.currentPosition === null).length,
      buckets: [
        { label: "Top 3", count: count(1, 3) },
        { label: "4–10", count: count(4, 10) },
        { label: "11–20", count: count(11, 20) },
        { label: "21–50", count: count(21, 50) },
        { label: "51–100", count: count(51, 100) },
      ],
      rising: movers.filter((item) => item.tone === "up" || item.tone === "new").slice(0, 3).map((item) => ({ ...item, position: item.currentPosition })),
      declining: movers.filter((item) => item.tone === "down" && item.currentPosition !== null).slice(0, 3).map((item) => ({ ...item, position: item.currentPosition })),
      lostItems: movers.filter((item) => item.tone === "down" && item.currentPosition === null).slice(0, 3).map((item) => ({ ...item, position: item.currentPosition })),
    };
    keywords = ready(data, [{ kind: "verified", source: "gsc", observedAt: searchData.syncedAt, detail: "Latest stored rank observations" }]);
  }

  const competitorData: CompetitorSummary = {
    websiteLabel: context.website.business_name?.trim() || context.website.normalized_domain,
    competitors: context.competitors.map((item) => ({ name: item.name, url: item.url })),
  };
  const competitors = competitorData.competitors.length
    ? ready(competitorData)
    : empty<CompetitorSummary>("No competitors are saved yet. Add them in the existing audit and strategy tools.");

  let calendar: ReboundHomeView["calendar"];
  try {
    const scoped = await scopedClient(context.website.id);
    const { data: plans, error: planError } = await scoped.select("publishing_plans", "id,status,timezone,start_date,end_date,updated_at").order("updated_at", { ascending: false }).limit(1);
    if (planError) {
      calendar = failed("The publishing calendar could not be loaded.");
    } else if (!plans?.[0]) {
      calendar = empty<CalendarSummary>("No publishing plan is active yet. Your saved schedule will appear here when it exists.");
    } else {
      const plan = plans[0];
      const { data: items, error: itemError } = await scoped.select("publishing_schedule_items", "id,plan_id,keyword,title,scheduled_for,state").eq("plan_id", plan.id).order("scheduled_for");
      if (itemError) {
        calendar = failed("The publishing schedule could not be loaded.");
      } else {
        const events = (items ?? []).flatMap((item) => {
          const date = typeof item.scheduled_for === "string" ? item.scheduled_for : "";
          if (!date) return [];
          const title = typeof item.title === "string" && item.title.trim()
            ? item.title
            : typeof item.keyword === "string" && item.keyword.trim() ? item.keyword : "Scheduled content";
          const state = typeof item.state === "string" ? item.state : "scheduled";
          return [{ id: String(item.id), date, title, state, tone: calendarTone(state) } satisfies CalendarEvent];
        });
        if (!events.length) {
          calendar = empty<CalendarSummary>("The publishing plan has no scheduled content yet.");
        } else {
          const anchor = new Date(events[0].date);
          calendar = ready({ month: monthLabel(Number.isNaN(anchor.getTime()) ? new Date() : anchor), events }, [{ kind: "verified", source: "schedule", observedAt: typeof plan.updated_at === "string" ? plan.updated_at : null, detail: "Saved publishing plan" }]);
        }
      }
    }
  } catch {
    calendar = failed("The publishing calendar could not be loaded.");
  }

  return {
    firstName: context.profile?.first_name?.trim() || null,
    websiteLabel: context.website.business_name?.trim() || context.website.normalized_domain,
    websiteId: context.website.id,
    queue,
    searchConsole,
    analytics,
    keywords,
    competitors,
    calendar,
  };
}
