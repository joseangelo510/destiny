import { WorkspaceLink } from "./workspace-link";

export function RepurposeGenerationError({ error, billingRequired, title, retryHint }: {
  error: string | null; billingRequired: boolean; title: string; retryHint: string;
}) {
  if (!error) return null;
  return <div role="alert" className="repurpose-error">
    <strong>{title}</strong>
    <p>{error}{!billingRequired && retryHint}</p>
    {billingRequired && <WorkspaceLink className="button" href="/account/billing">View plans and billing</WorkspaceLink>}
  </div>;
}
