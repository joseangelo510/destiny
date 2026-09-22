export function reviewPresentation(storageReady: boolean, qualityVerified: boolean, generationStatus: string, canApprove: boolean) {
  if (!storageReady) return { pending: true, label: "Loading saved review", summary: "Loading saved review decisions…" };
  if (!qualityVerified) return { pending: true, label: "Checking draft", summary: "Checking the saved article…" };
  return {
    pending: false,
    label: canApprove ? "Ready for human review" : generationStatus === "generated" ? "Needs another pass" : "Full article not generated",
    summary: canApprove ? "Internal checks passed" : "Areas Rebound SEO will improve",
  };
}
