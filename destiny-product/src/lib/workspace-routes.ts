import { isWebsiteId, siteScopedHref } from "./workspace-selection";

export const WORKSPACE_ROUTE_ROOTS = [
  "/account",
  "/analytics",
  "/app",
  "/audits",
  "/backlinks",
  "/content",
  "/distribution",
  "/growth-plan",
  "/integrations",
  "/keyword-research",
  "/keywords",
  "/llm-visibility",
  "/rank-tracker",
  "/reoptimization",
  "/results",
  "/reviews",
  "/roadmap",
  "/this-week",
] as const;

export function isWorkspacePathname(pathname: string) {
  return WORKSPACE_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function workspaceRedirectHref({
  activeWebsiteId,
  pathname,
  requestedWebsiteId,
  search,
}: {
  activeWebsiteId: unknown;
  pathname: string;
  requestedWebsiteId: unknown;
  search: string;
}) {
  if (!isWorkspacePathname(pathname) || isWebsiteId(requestedWebsiteId) || !isWebsiteId(activeWebsiteId)) return null;
  return siteScopedHref(`${pathname}${search}`, activeWebsiteId);
}
