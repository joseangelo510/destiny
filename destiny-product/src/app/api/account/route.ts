import { createClient } from "../../../lib/supabase/server";
import { isWebsiteId } from "../../../lib/workspace-selection";

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return Response.json({ error: "Sign in again to manage this account." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { notificationEmail?: unknown; websiteId?: unknown };
  const notificationEmail = validEmail(body.notificationEmail);
  if (!notificationEmail) return Response.json({ error: "Enter a valid audit and contact email." }, { status: 400 });
  if (!isWebsiteId(body.websiteId)) return Response.json({ error: "Choose a website before changing its notification email." }, { status: 400 });

  const { data: website, error } = await supabase.from("websites")
    .update({ notification_email: notificationEmail, updated_at: new Date().toISOString() })
    .eq("id", body.websiteId)
    .select("notification_email")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!website) return Response.json({ error: "Destiny could not find that website in this account." }, { status: 404 });
  return Response.json({ notificationEmail: website.notification_email });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const email = data.user?.email?.trim().toLowerCase();
  if (userError || !data.user || !email) return Response.json({ error: "Sign in again to manage this account." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
  if (confirmation !== email) return Response.json({ error: "Enter your current login email exactly to confirm deletion." }, { status: 400 });

  const { data: deletion, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", {
    body: { confirmation: email },
  });
  if (error || !deletion?.deleted) {
    return Response.json({ error: deletion?.error || error?.message || "Destiny could not delete this account." }, { status: 409 });
  }

  await supabase.auth.signOut();
  return Response.json({ deleted: true });
}
