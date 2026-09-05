import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { transpileModule } from "typescript";
import { describe, expect, it } from "vitest";
import { buildHomeCompetitorSummary } from "@/lib/rebound-core/home-competitor-summary";
import { ready } from "@/lib/rebound-core/panel-result";
import { HomeCompetitors } from "./home-competitors";
import { MonthCalendar } from "./month-calendar";
import { ReboundCoreShell } from "./rebound-core-shell";

describe("visible-core production candidate safety", () => {
  it("does not present an Agent whose production migration is unapplied", async () => {
    const html = renderToStaticMarkup(<ReboundCoreShell active="/app/home" queue={ready({ items: [], sessionMoves: [] })} searchConnected={false} websiteId="site-1" websiteLabel="Example" websites={[]}><p>Home</p></ReboundCoreShell>);
    expect(html).not.toContain("Ask Rebound");
    expect(html).not.toContain("/app/agent");
    for (const file of ["../../app/app/agent/page.tsx", "../../app/api/agent/turn/route.ts"]) {
      await expect(access(new URL(file, import.meta.url))).rejects.toThrow();
    }
  });

  it("keeps shared draft-write JavaScript identical when relocating its Agent-only type", async () => {
    const current = await readFile(new URL("../../lib/drafts/createDraft.ts", import.meta.url), "utf8");
    const before = execFileSync("git", ["show", "eaf0d7d:destiny-product/src/lib/drafts/createDraft.ts"], { encoding: "utf8" });
    expect(current).not.toContain("@/lib/agent");
    expect(transpileModule(current, {}).outputText).toBe(transpileModule(before, {}).outputText);
  });

  it("rejects coercible missing overlap and receipts from other providers", () => {
    for (const value of [null, undefined, "", " ", false, true, "17", -1, Infinity, NaN]) {
      const summary = buildHomeCompetitorSummary({ websiteLabel: "Example", saved: [], providerResult: { source: "dataforseo", competitors: [{ domain: "other.example", sharedKeywords: value }] } });
      expect(summary.competitors[0].sharedKeywords).toBeNull();
    }
    const demo = buildHomeCompetitorSummary({ websiteLabel: "Example", saved: [{ name: "Saved", url: "https://saved.example" }], providerResult: { source: "demo", sourceLabel: "Demo", fetchedAt: "2026-09-01", competitors: [{ domain: "fake.example", sharedKeywords: 42 }] } });
    expect(demo).toMatchObject({ sourceLabel: null, fetchedAt: null, competitors: [{ name: "Saved", sharedKeywords: null }] });
  });

  it("does not claim historical unmatched zeroes are measured shared keywords", () => {
    const data = buildHomeCompetitorSummary({ websiteLabel: "Example", saved: [], providerResult: { source: "dataforseo", competitors: [{ domain: "other.example", sharedKeywords: 0 }] } });
    const html = renderToStaticMarkup(<HomeCompetitors result={ready(data)} websiteId="site-1" />);
    expect(html).toContain("No overlap measured in this audit");
    expect(html).not.toContain("0 shared keywords");
    expect(html).toContain("0 competitors have measured search overlap");
  });

  it("keeps an unscheduled compact month visible with no saved events", async () => {
    const html = renderToStaticMarkup(<MonthCalendar data={{ month: "September 2026", anchorDate: "2026-09-01", events: [], suggestions: [{ id: "topic-1", title: "Approved keyword", approvedAt: "2026-09-01" }] }} />);
    expect(html).toContain('data-empty-month="true"');
    expect(html).toContain("No saved items this month");
    expect(html).toContain("Approved topic · not scheduled");
    const css = await readFile(new URL("./home-dashboard.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.calendarGrid\[data-empty-month="true"\]\s*\{[^}]*display:\s*grid/);
  });
});
