import { createClient } from "../../../lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const email = data.user?.email?.trim().toLowerCase();
  if (userError || !data.user || !email) return Response.json({ error: "Sign in again to manage this account." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
  if (confirmation !== email) return Response.json({ error: "Enter your current login email exactly to confirm deletion." }, { status: 400 });
  const { data: deletion, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", { body: { confirmation: email } });
  if (error || !deletion?.deleted) return Response.json({ error: deletion?.error || error?.message || "Destiny could not delete this account." }, { status: 409 });
  await supabase.auth.signOut();
  return Response.json({ deleted: true });
}
