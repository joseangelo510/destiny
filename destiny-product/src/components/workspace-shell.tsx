import type { ReactNode } from "react";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { isCommsBetaEnabled } from "@/lib/comms/feature";
import { WorkspaceShellView } from "./workspace-shell-view";

export async function WorkspaceShell({
  active,
  eyebrow,
  title,
  description,
  design,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  design?: "claude-keyword-strategy";
  children: ReactNode;
}) {
  const context = await getWorkspaceContext();
  return <WorkspaceShellView active={active} activeWebsiteId={context.website?.id ?? null} commsEnabled={isCommsBetaEnabled()} description={description} design={design} eyebrow={eyebrow} title={title} websites={context.websites}>{children}</WorkspaceShellView>;
}
