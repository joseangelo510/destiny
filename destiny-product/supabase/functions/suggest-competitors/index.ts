import { withSupabase } from "@supabase/server";
import { parseCompetitorSuggestions } from "./logic.ts";

type SuggestionRequest = {
  website?: unknown;
  locationName?: unknown;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeDomain(value: string) {
  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(withProtocol);
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!domain || !domain.includes(".") || domain === "localhost") throw new Error("Enter a valid public website.");
  return domain;
}

function authorization(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    let body: SuggestionRequest;
    try {
      body = await request.json() as SuggestionRequest;
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }
    if (typeof body.website !== "string") return json({ error: "Enter a valid public website." }, 400);

    let target: string;
    try {
      target = normalizeDomain(body.website);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : "Enter a valid public website." }, 400);
    }
    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    if (!login || !password) return json({ suggestions: [], provider: "unavailable" });

    const response = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live", {
      method: "POST",
      headers: { Authorization: authorization(login, password), "Content-Type": "application/json" },
      body: JSON.stringify([{
        target,
        location_name: typeof body.locationName === "string" && body.locationName.trim() ? body.locationName.trim() : "United States",
        language_name: "English",
        item_types: ["organic", "local_pack"],
        exclude_top_domains: true,
        order_by: ["intersections,desc"],
        limit: 10,
      }]),
    });
    if (!response.ok) return json({ suggestions: [], provider: "failed" });
    const payload = await response.json();
    return json({ suggestions: parseCompetitorSuggestions(payload, target), provider: "dataforseo" });
  }),
};
