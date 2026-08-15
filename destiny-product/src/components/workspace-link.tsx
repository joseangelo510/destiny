"use client";

import Link, { type LinkProps } from "next/link";
import { createContext, type AnchorHTMLAttributes, type ReactNode, useContext } from "react";
import { siteScopedHref } from "@/lib/workspace-selection";

const WorkspaceWebsiteContext = createContext<string | null>(null);

export function WorkspaceWebsiteProvider({ children, websiteId }: { children: ReactNode; websiteId: string | null }) {
  return <WorkspaceWebsiteContext.Provider value={websiteId}>{children}</WorkspaceWebsiteContext.Provider>;
}

export function useWorkspaceHref(href: string) {
  return siteScopedHref(href, useContext(WorkspaceWebsiteContext));
}

export function WorkspaceLink({ href, ...props }: LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { children?: ReactNode }) {
  const scopedHref = useWorkspaceHref(typeof href === "string" ? href : href.pathname ?? "/app");
  return <Link href={scopedHref} {...props} />;
}
