const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 30;

function calendarAgeDays(date: Date, now: Date) {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - day) / DAY_MS));
}

export function LlmEvidenceSnapshot({ auditId, completedAt, now, status }: {
  auditId: string | null;
  completedAt: string | null;
  now: Date;
  status: unknown;
}) {
  const completed = completedAt ? new Date(completedAt) : null;
  const dated = completed && !Number.isNaN(completed.getTime()) ? completed : null;
  if (status !== "available") {
    return <section className="workspace-card" aria-label="Provider snapshot context">
      <strong>No dated provider snapshot is available</strong>
      <p>A completed audit is needed before Rebound SEO can show provider-reported AI visibility.</p>
    </section>;
  }

  const ageDays = dated ? calendarAgeDays(dated, now) : null;
  const dateLabel = dated ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(dated) : null;
  return <section className="workspace-card" aria-label="Provider snapshot context">
    <strong>Provider-reported AI visibility snapshot</strong>
    <p>{dateLabel ? <>Saved from the completed audit on <time dateTime={completedAt ?? undefined}>{dateLabel}</time> · {ageDays} {ageDays === 1 ? "day" : "days"} old.</> : "Audit date unavailable for these provider-reported aggregates."}</p>
    {ageDays !== null && ageDays > STALE_AFTER_DAYS ? <p><strong>Older than 30 days.</strong> A new completed website audit is needed to update these counts.</p> : null}
    <p>These are provider-reported aggregates across available AI platforms. Individual prompts and answers are not saved with this summary.</p>
    {auditId ? <a href={`/audits/${auditId}`}>View the source audit</a> : null}
  </section>;
}
