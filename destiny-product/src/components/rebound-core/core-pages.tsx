import Link from "next/link";
import type { ReactNode } from "react";
import type { ReboundCalendarView, ReboundContentView, ReboundDistributionView, ReboundDraftView, ReboundProgressView } from "@/lib/rebound-core/load-core-pages";
import type { ReboundCoreWorkspace } from "@/lib/rebound-core/contracts";
import { calendarMonthCells } from "@/lib/rebound-core/core-pages";
import { siteScopedHref } from "@/lib/workspace-selection";
import { MonthCalendar } from "./month-calendar";
import { CalendarActions } from "./calendar-actions";
import { EvidenceChip, MoveChip, NeedsYouBar, Panel, PanelHeader, StateChip, StatusStrip } from "./primitives";
import { ReboundCoreShell } from "./rebound-core-shell";
import { DraftApprovalActions } from "./draft-approval-actions";
import { DistributionOpportunityActions } from "./distribution-opportunity-actions";
import { ProgressReportActions } from "./progress-report-actions";
import styles from "./core-pages.module.css";

function scopedHref(href: string, websiteId: string) {
  return /^https?:\/\//.test(href) ? href : siteScopedHref(href, websiteId);
}

function Action({ href, label, websiteId, hot = false }: { href: string; label: string; websiteId: string; hot?: boolean }) {
  const resolved = scopedHref(href, websiteId);
  if (/^https?:\/\//.test(resolved)) return <a className={`${styles.action} ${hot ? styles.actionHot : ""}`} href={resolved} rel="noreferrer" target="_blank">{label} ↗</a>;
  return <MoveChip href={resolved} label={label} tone={hot ? "hot" : "default"} />;
}

function Shell({ active, calendarActions = false, children, distributionActions = false, draftActions = false, progressActions = false, view, title, subtitle }: { active: string; calendarActions?: boolean; children: ReactNode; distributionActions?: boolean; draftActions?: boolean; progressActions?: boolean; view: ReboundCoreWorkspace; title?: string; subtitle?: string }) {
  return <ReboundCoreShell active={active} calendarActions={calendarActions} distributionActions={distributionActions} draftActions={draftActions} progressActions={progressActions} queue={view.queue} searchConnected={view.searchConnected} subtitle={subtitle} title={title} websiteId={view.websiteId} websiteLabel={view.websiteLabel}>{children}</ReboundCoreShell>;
}

function EmptyPage({ active, actionHref, actionLabel, message, view }: { active: string; actionHref: string; actionLabel: string; message: string | null; view: ReboundCoreWorkspace }) {
  return <Shell active={active} view={view}><div className={styles.page}><NeedsYouBar detail="There is no hidden estimate behind this state." title="Nothing needs you on this page yet" /><Panel><div className={styles.empty}><h2>Waiting for saved data</h2><p>{message}</p><Action href={actionHref} label={actionLabel} websiteId={view.websiteId} /></div></Panel></div></Shell>;
}

function BackToContentPipeline({ websiteId }: { websiteId: string }) {
  return <Link className={styles.back} href={siteScopedHref("/app/content", websiteId)}>← Back to pipeline</Link>;
}

export function ContentDashboard({ view }: { view: ReboundContentView }) {
  if (view.pipeline.state !== "ready" || !view.pipeline.data) return <EmptyPage active="/app/content" actionHref="/content" actionLabel="Open Content Studio" message={view.pipeline.message} view={view} />;
  const data = view.pipeline.data;
  const firstDraft = data.columns.find((column) => column.state === "draft")?.items[0];
  return <Shell active="/app/content" view={view}><div className={styles.page}>
    <NeedsYouBar detail={firstDraft ? "This is the first saved draft awaiting human judgment." : "Every saved piece has moved beyond draft review."} move={firstDraft ? { href: scopedHref(firstDraft.href, view.websiteId), label: firstDraft.moveLabel } : undefined} title={firstDraft?.title ?? "No draft is waiting on you"} />
    <StatusStrip items={[
      { label: "DONE", value: String(data.stats.done), detail: "published or verified" },
      { label: "NEEDS YOU", value: String(data.stats.needsUser), detail: "saved drafts to review" },
      { label: "PROGRESS", value: `${data.stats.verified}/${data.items.length}`, detail: "verified live" },
      { label: "STUCK", value: String(data.stats.stuck), detail: "published, awaiting proof" },
    ]} />
    <div className={styles.filters}><span className={styles.filterOn}>All · {data.items.length}</span><span>Needs me · {data.stats.needsUser}</span><span>Sort: true state</span></div>
    <section aria-label="Content pipeline" className={styles.pipeline}>{data.columns.map((column) => <div className={`${styles.column} ${column.state === "verified_live" ? styles.liveColumn : ""}`} key={column.state}><header><b>{column.label}</b><span>{column.items.length}</span></header>{column.items.length ? column.items.map((item) => <article className={styles.contentCard} key={item.id}><strong>{item.title}</strong><small>{item.keyword}</small><p>{item.detail}</p><footer><StateChip state={item.state} />{item.evidenceKind ? <EvidenceChip evidence={{ kind: item.evidenceKind, source: item.evidenceKind === "verified" ? "crawl" : "schedule", observedAt: null, detail: item.evidenceKind === "verified" ? "Verified evidence" : "Saved state" }} /> : null}<Action href={item.href} hot={item.state === "draft"} label={item.moveLabel} websiteId={view.websiteId} /></footer></article>) : <p className={styles.columnEmpty}>No saved items in this state.</p>}</div>)}</section>
    <p className={styles.read}><b>Read:</b> each piece appears once, in its highest supported state. “Verified live” requires complete public evidence.</p>
  </div></Shell>;
}

export function DraftDashboard({ view }: { view: ReboundDraftView }) {
  const status = view.draft.approved ? "approved" as const : "draft" as const;
  const updated = view.draft.updatedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(view.draft.updatedAt)) : "saved date unavailable";
  return <Shell active="/app/content" draftActions subtitle="review and approve the saved draft" title="Content" view={view}><div className={styles.page}>
    <BackToContentPipeline websiteId={view.websiteId} />
    <NeedsYouBar detail={view.draft.approved ? "Reopen only if this article needs another editing pass." : "Approval is available here only after the existing article-quality checks pass."} move={{ href: "#draft-actions", label: view.draft.approved ? "Review approval" : "Check approval" }} title={view.draft.approved ? "This saved draft is approved" : "Review this saved draft"} />
    <div className={styles.articleLayout}><article className={styles.document}><div className={styles.kicker}><StateChip state={status} /><span>{view.draft.keyword}</span><span>{view.draft.generationStatus.replaceAll("_", " ")}</span><span>Updated {updated}</span></div><h2>{view.draft.title}</h2><p className={styles.meta}>Exact saved article body. Approval uses the same quality rules as Content Studio.</p><div className={styles.articleBody}>{view.draft.body}</div></article><aside className={styles.articleRail}><div className={styles.railAction}><span>YOUR MOVE</span><h3>{view.draft.approved ? "Approved and ready for its next delivery step." : "Approve when the article passes every saved quality check."}</h3><p>Edit the draft in Content Studio when revisions are needed. Rebound SEO does not record a separate edit request here.</p><DraftApprovalActions auditId={view.auditId} draft={view.draft.data} websiteId={view.websiteId} /></div><Panel><PanelHeader title="Current saved state" /><div className={styles.railRows}><p><span>Keyword</span><b>{view.draft.keyword}</b></p><p><span>Draft</span><StateChip state={status} /></p><p><span>Generation</span><b>{view.draft.generationStatus.replaceAll("_", " ")}</b></p><p><span>Verification</span><EvidenceChip fallback="After publish" /></p></div></Panel></aside></div>
  </div></Shell>;
}

export function CalendarDashboard({ view }: { view: ReboundCalendarView }) {
  if (view.calendarView.state !== "ready" || !view.calendarView.data) return <EmptyPage active="/app/calendar" actionHref="/content#publishing-plan" actionLabel="Open publishing plan" message={view.calendarView.message} view={view} />;
  const data = view.calendarView.data;
  const studioHref = siteScopedHref("/content#publishing-plan", view.websiteId);
  const openDates = calendarMonthCells(data.calendar.events).filter((cell) => cell.inMonth && !cell.events.length).map((cell) => cell.key);
  return <Shell active="/app/calendar" calendarActions view={view}><div className={styles.page}>
    <NeedsYouBar detail={data.needsYou?.detail ?? "The saved publishing plan has no review item."} move={data.needsYou ? { href: scopedHref(data.needsYou.href, view.websiteId), label: data.needsYou.moveLabel } : undefined} title={data.needsYou?.title ?? "The calendar can run without you"} />
    <StatusStrip items={[
      { label: "DONE", value: String(data.stats.done), detail: "saved completed items" },
      { label: "NEEDS YOU", value: String(data.stats.needsUser), detail: "items needing review" },
      { label: "IN MOTION", value: String(data.stats.scheduled), detail: "planned or scheduled" },
      { label: "STUCK", value: String(data.stats.stuck), detail: "failed items" },
    ]} />
    <Panel><PanelHeader action="Open publishing plan" href={studioHref} subtitle="saved items only · mobile becomes an agenda" title="The month" /><MonthCalendar data={data.calendar} emptyDayHref="#calendar-actions" /></Panel>
    <CalendarActions approvedDrafts={view.approvedDrafts} openDates={openDates} studioHref={studioHref} timeZone={view.planTimezone} websiteId={view.websiteId} />
    <div className={styles.calendarMetaGrid}><Panel><div className={styles.calendarMeta}><span>Cadence</span><h3>{data.cadence.label}</h3><p>{data.cadence.detail}</p><Action href="/content#publishing-plan" label="Edit in Content Studio" websiteId={view.websiteId} /></div></Panel><Panel><div className={styles.calendarMeta}><span>Milestone</span><h3>Milestone not configured</h3><p>No workspace milestone is stored, so Rebound SEO will not invent a target or progress claim.</p></div></Panel></div>
    <Panel><PanelHeader subtitle="one honest state and one move per row" title="Schedule" /><div className={styles.list}>{data.rows.map((row) => <article key={row.id}><div><strong>{row.title}</strong><small>{row.detail}</small></div><StateChip label={row.state.replaceAll("_", " ")} state={row.state === "published" || row.state === "verified_live" ? row.state : row.state === "scheduled" || row.state === "managed_externally" ? "scheduled" : row.state === "needs_review" ? "approved" : "idea"} /><Action href={row.href} hot={row.state === "needs_review" || row.state === "failed"} label={row.moveLabel} websiteId={view.websiteId} /></article>)}</div></Panel>
  </div></Shell>;
}

export function DistributionDashboard({ view }: { view: ReboundDistributionView }) {
  if (view.distribution.state !== "ready" || !view.distribution.data) return <EmptyPage active="/app/distribution" actionHref="/distribution" actionLabel="Open Distribution tool" message={view.distribution.message} view={view} />;
  const data = view.distribution.data;
  return <Shell active="/app/distribution" distributionActions view={view}><div className={styles.page}>
    <NeedsYouBar detail={data.needsYou?.detail ?? "There are no saved distribution moves waiting on you."} move={data.needsYou ? { href: scopedHref(data.needsYou.href, view.websiteId), label: data.needsYou.moveLabel } : undefined} title={data.needsYou?.title ?? "Distribution is calm"} />
    <StatusStrip items={[
      { label: "READY", value: String(data.stats.ready), detail: "saved community matches" },
      { label: "NEEDS YOU", value: String(data.stats.needsUser), detail: "manual next moves" },
      { label: "VERIFIED", value: String(data.stats.verified), detail: "crawler-confirmed interlinks" },
      { label: "STUCK", value: String(data.stats.stuck), detail: "interlinks awaiting proof" },
    ]} />
    <div className={styles.filters}><span className={styles.filterOn}>Quora · {data.platformCounts.Quora}</span><span>Reddit · {data.platformCounts.Reddit}</span><span>valid saved destinations only</span></div>
    <Panel><PanelHeader href={siteScopedHref("/distribution", view.websiteId)} subtitle="existing opportunities and interlink evidence only" title="Reach what you published" /><div className={styles.timeline}>{data.rows.map((row, index) => <article data-distribution-kind={row.kind} id={`distribution-${row.id}`} key={row.id}><span className={styles.when}>{index + 1}</span><i className={row.evidenceKind === "verified" ? styles.dotVerified : ""} /><div><strong>{row.title}</strong><small>{row.detail}</small><em>{row.owner === "you" ? "you move" : row.owner === "rebound" ? "Rebound" : "evidence"}</em></div><EvidenceChip evidence={{ kind: row.evidenceKind, source: row.evidenceKind === "verified" ? "crawl" : "quest", observedAt: row.action?.checkedAt ?? null, detail: row.freshness?.label ?? (row.evidenceKind === "verified" ? "Verified" : "Saved evidence") }} />{row.kind === "opportunity" ? <DistributionOpportunityActions action={row.action} reverifyHref={siteScopedHref("/distribution#community", view.websiteId)} stale={row.freshness?.stale ?? true} /> : <Action href={row.href} hot={row.owner === "you"} label={row.moveLabel} websiteId={view.websiteId} />}</article>)}</div></Panel>
    <p className={styles.read}><b>Read:</b> no touchpoint ledger is invented or approved. Community posting stays yours in the live thread; existing Rebound SEO tools remain unchanged.</p>
  </div></Shell>;
}

export function ProgressDashboard({ view }: { view: ReboundProgressView }) {
  if (view.progress.state !== "ready" || !view.progress.data) return <EmptyPage active="/app/progress" actionHref="/this-week" actionLabel="Open this week" message={view.progress.message} view={view} />;
  const data = view.progress.data;
  const ownerGroups = [{ label: "You", subtitle: "your clear next moves", items: data.owners.you }, { label: "Rebound", subtitle: "saved work in motion", items: data.owners.rebound }, { label: "Waiting on Google", subtitle: "nothing to report as verified yet", items: data.owners.google }];
  return <Shell active="/app/progress" progressActions view={view}><div className={styles.page}>
    <NeedsYouBar detail={data.needsYou?.detail ?? "There is no saved move requiring your input."} move={data.needsYou ? { href: scopedHref(data.needsYou.href, view.websiteId), label: data.needsYou.moveLabel } : undefined} title={data.needsYou?.title ?? "Nothing needs you right now"} />
    <StatusStrip items={[
      { label: "DONE", value: String(data.stats.done), detail: "completed saved moves" },
      { label: "NEEDS YOU", value: String(data.stats.needsUser), detail: "open moves" },
      { label: "IN MOTION", value: String(data.stats.inMotion), detail: "Rebound or Google" },
      { label: "STUCK", value: String(data.stats.stuck), detail: "named blockers" },
    ]} />
    <ProgressReportActions recipient={view.reportRecipient} websiteId={view.websiteId} />
    <section><div className={styles.sectionHeading}><h2>What’s been done</h2><span>verified and reported are intentionally different</span></div><Panel><div className={styles.doneList}>{data.done.map((item) => <article key={item.id}><time>{item.at ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(item.at)) : "Saved"}</time><div><strong>{item.title}</strong><small>{item.detail}</small></div><EvidenceChip evidence={{ kind: item.evidenceKind, source: item.evidenceKind === "verified" ? "quest" : "quest", observedAt: item.at, detail: item.evidenceKind === "verified" ? "Verified" : "Reported" }} /><Action href={item.href} label={item.moveLabel} websiteId={view.websiteId} /></article>)}</div></Panel></section>
    <section><div className={styles.sectionHeading}><h2>What needs to be done</h2><span>split by who owns it</span></div><div className={styles.ownerGrid}>{ownerGroups.map((group) => <Panel key={group.label}><header className={styles.ownerHeader}><h3>{group.label}</h3><span>{group.items.length}</span><small>{group.subtitle}</small></header><div className={styles.ownerRows}>{group.items.length ? group.items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small></div><EvidenceChip evidence={{ kind: item.evidenceKind, source: "schedule", observedAt: item.at, detail: group.label }} /><Action href={item.href} hot={group.label === "You"} label={item.moveLabel} websiteId={view.websiteId} /></article>) : <p>Nothing in this lane.</p>}</div></Panel>)}</div></section>
    <section><div className={styles.sectionHeading}><h2>Where we are</h2><span>honest counts from saved work</span></div><div className={styles.milestones}>{data.milestones.map((item) => <Panel key={item.label}><strong>{item.value}<small> / {item.total}</small></strong><span>{item.label}</span><i><b style={{ width: `${item.total ? Math.min(100, Math.round(item.value / item.total * 100)) : 0}%` }} /></i></Panel>)}</div></section>
    <section><div className={styles.sectionHeading}><h2>What’s stuck</h2><span>and the move that can unstick it</span></div><Panel><div className={styles.list}>{data.blockers.length ? data.blockers.map((item) => <article key={item.id}><div><strong>{item.title}</strong><small>{item.detail}</small></div><EvidenceChip evidence={{ kind: "reported", source: "quest", observedAt: null, detail: "Named blocker" }} /><Action href={item.href} hot label={item.moveLabel} websiteId={view.websiteId} /></article>) : <p className={styles.calm}>No saved blocker is active.</p>}</div></Panel></section>
  </div></Shell>;
}
