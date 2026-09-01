"use client";

import { useState } from "react";
import styles from "./rebound-core-shell.module.css";

function DismissPreview({ onDismiss }: { onDismiss: () => void }) {
  return <button aria-label="Dismiss preview notice" onClick={onDismiss} type="button">Dismiss</button>;
}

export function PreviewStrip({ calendarActions = false, distributionActions = false, draftActions = false, progressActions = false }: { calendarActions?: boolean; distributionActions?: boolean; draftActions?: boolean; progressActions?: boolean }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className={styles.previewStrip} role="status"><span>{draftActions ? <><strong>Preview — draft approval enabled.</strong> Approval uses the existing Content Studio record; editing stays in Content Studio.</> : calendarActions ? <><strong>Preview — calendar scheduling enabled.</strong> Approved drafts use the existing publishing plan; cadence and milestones stay read-only.</> : distributionActions ? <><strong>Preview — distribution actions enabled.</strong> Posting and approval remain in live channels and existing tools.</> : progressActions ? <><strong>Preview — progress reports enabled.</strong> One manual report uses the saved workspace email; acceptance is not delivery proof.</> : <><strong>Preview — read-only.</strong> These new core pages use current workspace data while your existing Rebound SEO tools remain unchanged.</>}</span><DismissPreview onDismiss={() => setVisible(false)} /></div>;
}
