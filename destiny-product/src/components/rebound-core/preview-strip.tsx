"use client";

import { useState } from "react";
import styles from "./rebound-core-shell.module.css";

export function PreviewStrip() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className={styles.previewStrip} role="status"><span><strong>Preview — read-only.</strong> This new Home uses current workspace data while your existing Rebound SEO tools remain unchanged.</span><button aria-label="Dismiss preview notice" onClick={() => setVisible(false)} type="button">Dismiss</button></div>;
}
