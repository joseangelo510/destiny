import type { ReactNode } from "react";
import { WorkspaceNotifications } from "./workspace-notifications";
import { WorkspaceWebsiteProvider } from "./workspace-link";
import { ProductNavigation } from "./product-navigation";

export type WorkspaceSite = { id: string; business_name: string | null; normalized_domain: string };

export function WorkspaceShellView({ active, eyebrow, title, description, design, children, websites = [], activeWebsiteId = null }: { active: string; eyebrow: string; title: string; description: string; design?: "claude-keyword-strategy" | "claude-analytics"; children: ReactNode; websites?: WorkspaceSite[]; activeWebsiteId?: string | null }) {
  return <WorkspaceWebsiteProvider websiteId={activeWebsiteId}><main className="app-shell prototype-workspace" data-design={design}>
    <ProductNavigation active={active} websiteId={activeWebsiteId} websites={websites} />
    <section className="dashboard workspace-page" data-active={active} data-workspace-website={activeWebsiteId ?? "none"} key={activeWebsiteId ?? "none"}><header className="workspace-header"><div className="workspace-header-copy"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><WorkspaceNotifications key={activeWebsiteId ?? "none"} websiteId={activeWebsiteId} /></header>{children}</section>
  </main></WorkspaceWebsiteProvider>;
}
