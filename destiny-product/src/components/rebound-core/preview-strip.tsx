"use client";

import { useState } from "react";
import styles from "./rebound-core-shell.module.css";

function DismissPreview({ onDismiss }: { onDismiss: () => void }) {
  return <button aria-label="Dismiss preview notice" onClick={onDismiss} type="button">Dismiss</button>;
}

export function PreviewStrip({ draftActions = false }: { draftActions?: boolean }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className={styles.previewStrip} role="status"><span>{draftActions ? <><strong>Preview — draft approval enabled.</strong> Approval uses the existing Content Studio record; editing stays in Content Studio.</> : <><strong>Preview — read-only.</strong> These new core pages use current workspace data while your existing Rebound SEO tools remain unchanged.</>}</span><DismissPreview onDismiss={() => setVisible(false)} /></div>;
}
