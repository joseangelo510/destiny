import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { workspaceHomeDestination } from "@/lib/rebound-core/routes";

export default async function WorkspaceHomePage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  redirect(workspaceHomeDestination(context.website.id));
}
