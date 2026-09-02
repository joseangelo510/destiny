import type { DraftProposalInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Valid<T> = { ok: true; value: T };
type Invalid = { ok: false; errors: string[] };
export type Validation<T> = Valid<T> | Invalid;

function text(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

export function validateTurnInput(value: unknown): Validation<{
  websiteId: string;
  message: string;
  conversationId: string | null;
}> {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const websiteId = typeof candidate.websiteId === "string" && UUID.test(candidate.websiteId)
    ? candidate.websiteId
    : null;
  const message = text(candidate.message, 4_000);
  const conversationId = candidate.conversationId === null || candidate.conversationId === undefined
    ? null
    : typeof candidate.conversationId === "string" && UUID.test(candidate.conversationId)
      ? candidate.conversationId
      : undefined;
  const errors = [
    ...(!websiteId ? ["Choose a valid website."] : []),
    ...(!message ? ["Enter a message up to 4,000 characters."] : []),
    ...(conversationId === undefined ? ["Choose a valid conversation."] : []),
  ];
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { websiteId: websiteId!, message: message!, conversationId: conversationId! } };
}

export function validateDraftProposal(value: unknown): Validation<DraftProposalInput> {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const title = text(candidate.title, 180);
  const targetKeyword = text(candidate.targetKeyword, 300);
  const angle = text(candidate.angle, 1_000);
  const outlineBullets = Array.isArray(candidate.outlineBullets)
    ? candidate.outlineBullets.slice(0, 12).map((item) => text(item, 300))
    : [];
  const errors = [
    ...(!title ? ["A title is required."] : []),
    ...(!targetKeyword ? ["A target keyword is required."] : []),
    ...(!angle ? ["An angle is required."] : []),
    ...(outlineBullets.length < 2 || outlineBullets.some((item) => !item)
      ? ["Include between 2 and 12 concise outline bullets."]
      : []),
  ];
  return errors.length ? { ok: false, errors } : {
    ok: true,
    value: { title: title!, targetKeyword: targetKeyword!, angle: angle!, outlineBullets: outlineBullets as string[] },
  };
}

export function safeAgentHref(value: unknown, selectedDomain: string) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    const normalizedDomain = selectedDomain.toLocaleLowerCase("en-US").replace(/^www\./, "");
    const hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
    return url.protocol === "https:" && hostname === normalizedDomain ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
