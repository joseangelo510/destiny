"use client";

import Link from "next/link";
import { useRef } from "react";

export function PrintGamePlanButton({
  displayName,
  needsReview = false,
}: {
  displayName: string;
  needsReview?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function sharePlan() {
    if (needsReview) {
      dialogRef.current?.showModal();
      return;
    }
    window.print();
  }

  return (
    <div className="game-plan-share-control">
      <button className="primary-button game-plan-share" onClick={sharePlan} type="button">Share this plan</button>
      {needsReview && (
        <dialog className="game-plan-share-dialog" ref={dialogRef}>
          <span className="eyebrow">One quick check</span>
          <h2>Confirm your business details</h2>
          <p>Destiny currently identifies this website as <strong>{displayName}</strong>. Confirm the business name before sharing so another name can never appear in your plan.</p>
          <div>
            <button className="secondary-button" onClick={() => dialogRef.current?.close()} type="button">Not now</button>
            <Link className="primary-button" href="/onboarding?new=1">Confirm business details</Link>
          </div>
        </dialog>
      )}
    </div>
  );
}
