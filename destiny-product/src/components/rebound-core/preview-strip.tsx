"use client";

import { useState } from "react";
import styles from "./rebound-core-shell.module.css";

function DismissPreview({ onDismiss }: { onDismiss: () => void }) {
  return <button aria-label="Dismiss preview notice" onClick={onDismiss} type="button">Dismiss</button>;
}

export function PreviewStrip({ calendarActions = false, distributionActions = false, draftActions = false, progressActions = false }: { calendarActions?: boolean; distributionActions?: boolean; draftActions?: boolean; progressActions?: boolean }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className={styles.previewStrip} role="status"><span>{draftActions ? <><strong>Preview — draft approval enabled.</strong> Review and approve your draft here. Open Content Studio to edit it.</> : calendarActions ? <><strong>Preview — calendar scheduling enabled.</strong> Schedule an approved draft here. Cadence and milestones are view-only.</> : distributionActions ? <><strong>Preview — distribution actions enabled.</strong> Copy your context, open the conversation, and review your reply before posting.</> : progressActions ? <><strong>Preview — progress reports enabled.</strong> Send a progress report to your account email. Sent status confirms acceptance, not inbox delivery.</> : <><strong>Preview — read-only.</strong> Explore your current progress here. Open the tools to make your next move.</>}</span><DismissPreview onDismiss={() => setVisible(false)} /></div>;
}
