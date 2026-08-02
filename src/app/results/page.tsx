import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function ResultsPage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  if (context.audit) redirect(`/audits/${context.audit.id}`);
  redirect("/this-week");
}
