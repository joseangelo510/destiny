import { WorkspaceLink } from "@/components/workspace-link";
export function TrackingNotice({ message }: { message: string }) {
  return message ? <aside className="configuration-note" role="status"><p>{message}</p><WorkspaceLink href="/rank-tracker">Review tracked keywords</WorkspaceLink> · <WorkspaceLink href="/account/billing">Plans and billing</WorkspaceLink></aside> : null;
}
