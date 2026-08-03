"use client";

import { useMemo, useState } from "react";
import { AUDIT_CATEGORIES, type AuditCategoryId, type AuditIssueView, type AuditSeverity } from "../lib/seo/audit-dashboard";

function pagePath(value: string | undefined) {
  if (!value) return "Page unavailable";
  try {
    return new URL(value).pathname || "/";
  } catch {
    return value;
  }
}

export function AuditIssueExplorer({ issues }: { issues: AuditIssueView[] }) {
  const [severity, setSeverity] = useState<"all" | AuditSeverity>("all");
  const [category, setCategory] = useState<"all" | AuditCategoryId>("all");
  const filtered = useMemo(() => issues.filter((issue) =>
    (severity === "all" || issue.severity === severity)
    && (category === "all" || issue.category === category)), [category, issues, severity]);
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return <section className="audit-issue-explorer" id="all-technical-issues">
    <div className="audit-section-heading">
      <div><span className="eyebrow">Complete technical list</span><h2>Issues found in this scan</h2><p>Filter the saved evidence, understand why each item matters, and take one repair at a time.</p></div>
      <strong>{filtered.length} of {issues.length}</strong>
    </div>
    <div className="audit-issue-controls">
      <div aria-label="Filter by severity" className="audit-severity-filter" role="group">
        {[
          ["all", `All issues ${issues.length}`],
          ["critical", `Critical ${criticalCount}`],
          ["warning", `Warnings ${warningCount}`],
        ].map(([value, label]) => <button aria-pressed={severity === value} key={value} onClick={() => setSeverity(value as "all" | AuditSeverity)} type="button">{label}</button>)}
      </div>
      <label>Category<select onChange={(event) => setCategory(event.target.value as "all" | AuditCategoryId)} value={category}>
        <option value="all">All categories</option>
        {AUDIT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
    </div>
    {!filtered.length ? <div className="audit-filter-empty"><strong>No issues match these filters</strong><p>Choose a different severity or category to review the rest of the scan.</p></div> : <div className="audit-issue-table" role="table" aria-label="Technical SEO issues">
      <div className="audit-issue-table-head" role="row"><span role="columnheader">Issue</span><span role="columnheader">Category</span><span role="columnheader">Affected pages</span><span role="columnheader">Guidance</span></div>
      {filtered.map((issue, index) => <div className="audit-issue-table-row" role="row" key={`${issue.code}-${index}`}>
        <div className="audit-issue-name" role="cell"><span className={`audit-severity-mark ${issue.severity}`} /><div><strong>{issue.label}</strong><small>{issue.severity === "critical" ? "Critical — address first" : "Warning — improve next"}</small></div></div>
        <span className="audit-category-pill" role="cell">{issue.categoryLabel}</span>
        <span className="audit-affected-pages" role="cell"><strong>{issue.affectedPages.length}</strong><small>{pagePath(issue.affectedPages[0])}</small></span>
        <details className="audit-issue-guidance" role="cell"><summary>View guidance</summary><div><strong>Why it matters</strong><p>{issue.whyItMatters}</p><strong>What to do next</strong><p>{issue.nextAction}</p>{issue.affectedPages[0] && <a href={issue.affectedPages[0]} rel="noreferrer" target="_blank">Open affected page ↗</a>}</div></details>
      </div>)}
    </div>}
  </section>;
}
