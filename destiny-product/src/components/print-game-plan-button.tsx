"use client";

export function PrintGamePlanButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      className="primary-button game-plan-export"
      disabled={disabled}
      onClick={() => window.print()}
      type="button"
    >
      {disabled ? "Confirm details to export" : "Export plan (PDF)"}
    </button>
  );
}
