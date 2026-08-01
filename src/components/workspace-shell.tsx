import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Overview", href: "/app" },
  { label: "Audits", href: "/audits" },
  { label: "Growth plan", href: "/growth-plan" },
  { label: "Content", href: "/content" },
  { label: "Distribution", href: "/distribution" },
  { label: "Reviews", href: "/reviews" },
  { label: "Analytics", href: "/analytics" },
  { label: "Connections", href: "/integrations" },
];

export function WorkspaceShell({
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
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/app"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <nav>
          {navigation.map((item) => (
            <Link className={item.href === active ? "active" : ""} href={item.href} key={item.label}><span className="nav-dot" />{item.label}</Link>
          ))}
        </nav>
        <div className="sidebar-card"><span className="logic-pulse" /><strong>LOGOS rules active</strong><p>Destiny’s next-action rules are compiled by LOGICAFFEINE.</p></div>
        <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit">Sign out</button></form>
      </aside>
      <section className="dashboard workspace-page">
        <header className="workspace-header">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
