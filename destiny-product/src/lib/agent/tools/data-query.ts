import "server-only";

import { scopedClient } from "@/lib/db";
import { list, record } from "@/lib/workspace-context";
import type { AgentToolContext, ToolQueryResult } from "../types";

function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metadataRows(metadata: unknown, key: string) {
  const raw = record(metadata);
  const direct = list(raw[key]);
  if (direct.length) return direct.map(record);
  const provider = record(raw.providerResult);
  return list(provider[key]).map(record);
}

function sortRows(items: Record<string, unknown>[], sort: string, limit: number) {
  const field = sort === "position_change" ? "positionChange" : sort;
  return [...items].sort((left, right) => sort === "position"
    ? number(left[field]) - number(right[field])
    : number(right[field]) - number(left[field])).slice(0, limit);
}

function requireRows(result: { data: unknown[] | null; error: unknown }, label: string) {
  if (result.error) throw new Error(label + " could not be loaded.");
  return rows(result.data);
}

function summarizeSearchDays(metadata: Record<string, unknown>, requestedDays: number) {
  const periods = record(metadata.periods);
  const exact = record(periods[String(requestedDays)]);
  if (Object.keys(exact).length) return { ...exact, requestedDays, sourceWindowDays: requestedDays };
  const source = record(periods[requestedDays === 90 ? "90" : "30"]);
  const daily = rows(source.daily).slice(-requestedDays);
  const previousDaily = rows(source.previousDaily).slice(-requestedDays);
  const aggregate = (items: Record<string, unknown>[]) => {
    const clicks = items.reduce((total, item) => total + number(item.clicks), 0);
    const impressions = items.reduce((total, item) => total + number(item.impressions), 0);
    const weightedPosition = items.reduce((total, item) => total + number(item.position) * number(item.impressions), 0);
    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  };
  const current = aggregate(daily);
  const previous = aggregate(previousDaily);
  return {
    requestedDays,
    sourceWindowDays: 30,
    ...current,
    previousClicks: previous.clicks,
    previousImpressions: previous.impressions,
    previousCtr: previous.ctr,
    previousPosition: previous.position,
    daily,
    previousDaily,
  };
}

export function createAgentToolQuery(): AgentToolContext["query"] {
  return async (name, input, scope): Promise<ToolQueryResult> => {
    const db = await scopedClient(scope.websiteId);
    if (name === "get_website_context") {
      const [websiteResult, auditResult, integrationResult] = await Promise.all([
        db.website("id,organization_id,business_name,normalized_domain,builder_profile"),
        db.select("audits", "id,status,provider,created_at").order("created_at", { ascending: false }).limit(1),
        db.select("integrations", "provider,status,last_synced_at,metadata").order("provider"),
      ]);
      const websites = requireRows(websiteResult, "Website context");
      const audits = requireRows(auditResult, "Latest audit");
      const integrations = requireRows(integrationResult, "Connection state");
      return {
        summary: "Loaded the selected website, latest audit, and connection state.",
        data: { website: websites?.[0] ?? null, audit: audits?.[0] ?? null, integrations: integrations ?? [] },
      };
    }
    if (name.startsWith("get_search_console_")) {
      const result = await db.select("integrations", "status,last_synced_at,metadata")
        .eq("provider", "google_search_console").limit(1);
      const integration = record(requireRows(result, "Search Console evidence")[0]);
      const metadata = record(integration.metadata);
      if (name === "get_search_console_summary") {
        const period = summarizeSearchDays(metadata, Number(input.days ?? 28));
        return {
          summary: integration.status === "connected"
            ? "Loaded the saved Search Console summary."
            : "Search Console is not connected.",
          data: { status: integration.status ?? "not_connected", syncedAt: integration.last_synced_at ?? null, period },
        };
      }
      const key = name === "get_search_console_queries" ? "queries" : "pages";
      const sourceKey = key === "queries" ? "topQueries" : "pages";
      const selected = sortRows(metadataRows(metadata, sourceKey), String(input.sort), Number(input.limit));
      return {
        summary: selected.length
          ? "Loaded " + selected.length + " saved Search Console " + key + "."
          : "No saved Search Console " + key + " are available yet.",
        data: { requestedDays: Number(input.days), availableWindowDays: key === "queries" ? 90 : null, rows: selected },
      };
    }
    if (name === "get_keyword_verdicts") {
      let query = db.select("keyword_preferences", "keyword,decision,reason,search_intent,search_volume,difficulty,priority_score,updated_at")
        .order("updated_at", { ascending: false }).limit(Number(input.limit));
      if (typeof input.verdict === "string") query = query.eq("decision", input.verdict);
      const result = await query;
      const data = requireRows(result, "Keyword decisions");
      return { summary: "Loaded " + data.length + " saved keyword decisions.", data };
    }
    if (name === "list_drafts" || name === "get_draft") {
      let query = db.select("article_drafts", "id,keyword,draft,updated_at")
        .order("updated_at", { ascending: false });
      if (name === "get_draft") query = query.eq("id", input.draftId).limit(1);
      else query = query.limit(Number(input.limit));
      const result = await query;
      let selected = requireRows(result, "Article drafts").map((item) => {
        const draft = record(item.draft);
        const body = typeof draft.body === "string" ? draft.body.slice(0, 6_000) : "";
        return { ...item, draft: { ...draft, body } };
      });
      if (name === "list_drafts" && typeof input.status === "string") {
        selected = selected.filter((item) => record(item.draft).generationStatus === input.status);
      }
      return {
        summary: name === "get_draft" ? (selected.length ? "Loaded the saved draft." : "Draft not found.") : "Loaded " + selected.length + " saved drafts.",
        data: name === "get_draft" ? selected[0] ?? null : selected,
      };
    }
    if (name === "get_calendar") {
      const result = await db.select("publishing_schedule_items", "id,title,keyword,scheduled_for,state,remote_permalink")
        .order("scheduled_for").limit(50);
      const selected = requireRows(result, "Publishing calendar").filter((item) => {
        const date = String(item.scheduled_for ?? "");
        return (!input.from || date >= String(input.from)) && (!input.to || date <= String(input.to));
      });
      return { summary: "Loaded " + selected.length + " saved calendar items.", data: selected };
    }
    if (name === "get_distribution_status") {
      const [linkResult, questResult] = await Promise.all([
        db.select("interlink_opportunities", "id,source_title,target_title,status,priority,updated_at")
          .order("updated_at", { ascending: false }).limit(25),
        db.select("quests", "id,title,status,task_type,due_at").order("priority").limit(25),
      ]);
      const links = requireRows(linkResult, "Interlink status");
      const quests = requireRows(questResult, "Distribution tasks");
      return {
        summary: "Loaded saved distribution and interlink status.",
        data: { interlinks: links, distributionTasks: quests.filter((item) => String(item.task_type).includes("distribution")) },
      };
    }
    if (name === "get_progress_summary") {
      const [questResult, trackedResult] = await Promise.all([
        db.select("quests", "id,title,status,category,due_at").order("priority").limit(50),
        db.select("tracked_keywords", "id,keyword,status,last_checked_at").order("created_at").limit(50),
      ]);
      const questRows = requireRows(questResult, "Progress tasks");
      const tracked = requireRows(trackedResult, "Tracked keywords");
      return {
        summary: "Loaded " + questRows.filter((item) => item.status !== "complete").length + " open moves and " + tracked.length + " tracked keywords.",
        data: {
          open: questRows.filter((item) => item.status !== "complete"),
          completed: questRows.filter((item) => item.status === "complete"),
          trackedKeywords: tracked,
        },
      };
    }
    if (name === "get_evidence") {
      const [auditResult, observationResult] = await Promise.all([
        db.select("audits", "id,status,provider,created_at").order("created_at", { ascending: false }).limit(Number(input.limit)),
        db.select("rank_observations", "observed_at,found,position,result_url,result_title")
          .order("observed_at", { ascending: false }).limit(Number(input.limit)),
      ]);
      const audits = requireRows(auditResult, "Audit evidence");
      const observations = requireRows(observationResult, "Ranking evidence");
      return {
        summary: "Loaded bounded saved audit and ranking evidence for " + String(input.topic) + ".",
        data: { topic: input.topic, audits, rankObservations: observations },
      };
    }
    throw new Error("Unsupported agent tool.");
  };
}
