import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { siteScopedHref } from "@/lib/workspace-selection";

export default async function WorkspaceHomePage() {
  const context = await getWorkspaceContext();
  if (!context.website) redirect("/onboarding");
  redirect(siteScopedHref("/this-week", context.website.id));
}
