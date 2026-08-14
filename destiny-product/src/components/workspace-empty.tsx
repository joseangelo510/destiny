import { WorkspaceLink as Link } from "./workspace-link";

export function WorkspaceEmpty({ title, description }: { title: string; description: string }) {
  return (
    <section className="workspace-empty">
      <span className="quest-icon">↗</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="primary-button workspace-action" href="/app">Go to the dashboard</Link>
    </section>
  );
}
