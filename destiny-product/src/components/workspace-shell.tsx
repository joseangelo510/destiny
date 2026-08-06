import type { ReactNode } from "react";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { WorkspaceShellView } from "./workspace-shell-view";

export async function WorkspaceShell({
  active,
  eyebrow,
  title,
  description,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const context = await getWorkspaceContext();
  return <WorkspaceShellView active={active} activeWebsiteId={context.website?.id ?? null} description={description} eyebrow={eyebrow} title={title} websites={context.websites}>{children}</WorkspaceShellView>;
}
