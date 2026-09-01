"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approvalGate, saveDraftApproval, type StoredArticleDraft } from "@/lib/rebound-core/draft-approval";
import { siteScopedHref } from "@/lib/workspace-selection";
import styles from "./core-pages.module.css";

type GateState = { checking: boolean; canApprove: boolean; message: string | null };

export function DraftApprovalActions({ auditId, draft, websiteId }: { auditId: string; draft: StoredArticleDraft; websiteId: string }) {
  const approved = draft.approved === true;
  const router = useRouter();
  const [gate, setGate] = useState<GateState>({ checking: !approved, canApprove: approved, message: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (approved) return () => { cancelled = true; };
    void approvalGate(draft).then((result) => {
      if (cancelled) return;
      setGate({
        checking: false,
        canApprove: result.canApprove,
        message: result.issues[0]?.message ?? null,
      });
    });
    return () => { cancelled = true; };
  }, [approved, draft]);

  const save = async () => {
    if (saving || (!approved && (gate.checking || !gate.canApprove))) return;
    setSaving(true);
    setError("");
    try {
      await saveDraftApproval({ auditId, approved: !approved, draft, websiteId });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rebound SEO could not save this approval yet.");
    } finally {
      setSaving(false);
    }
  };

  const label = saving
    ? approved ? "Reopening…" : "Approving…"
    : approved
      ? "Reopen this draft"
      : gate.checking
        ? "Checking approval requirements…"
        : gate.canApprove
          ? "Approve this draft"
          : "Fix issues before approval";

  return <div className={styles.approvalActions} id="draft-actions">
    <button className={approved ? styles.approvalSecondary : styles.approvalPrimary} disabled={saving || (!approved && (gate.checking || !gate.canApprove))} onClick={() => void save()} type="button">{label}</button>
    <Link className={styles.approvalSecondary} href={siteScopedHref("/content#article-review-workspace", websiteId)}>Edit in Content Studio</Link>
    {!approved && !gate.checking && gate.message ? <small className={styles.approvalStatus}>{gate.message}</small> : null}
    {error ? <small className={styles.approvalError} role="alert">{error}</small> : null}
  </div>;
}
