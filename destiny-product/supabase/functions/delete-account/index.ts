import { withSupabase } from "@supabase/server";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to manage this account." }, 401);

    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
    const { data: authUser, error: authUserError } = await context.supabaseAdmin.auth.admin.getUserById(userId);
    const loginEmail = authUser.user?.email?.trim().toLowerCase();
    if (authUserError || !loginEmail) return json({ error: "Destiny could not verify your login email." }, 401);
    if (confirmation !== loginEmail) return json({ error: "Enter your current login email exactly to confirm deletion." }, 400);

    const { data: ownedOrganizations, error: organizationError } = await context.supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("owner_id", userId);
    if (organizationError) return json({ error: "Destiny could not verify your workspaces." }, 500);

    const organizationIds = (ownedOrganizations ?? []).map((organization) => organization.id);
    if (organizationIds.length > 0) {
      const { data: otherMembers, error: memberError } = await context.supabaseAdmin
        .from("organization_members")
        .select("organization_id,user_id")
        .in("organization_id", organizationIds)
        .neq("user_id", userId)
        .limit(1);
      if (memberError) return json({ error: "Destiny could not verify workspace ownership." }, 500);
      if ((otherMembers ?? []).length > 0) {
        return json({ error: "Transfer ownership of shared workspaces before deleting your account." }, 409);
      }

      const { error: deleteOrganizationsError } = await context.supabaseAdmin
        .from("organizations")
        .delete()
        .in("id", organizationIds);
      if (deleteOrganizationsError) return json({ error: "Destiny could not remove your private workspace data." }, 500);
    }

    await context.supabase.auth.signOut({ scope: "global" });
    const { error: deleteUserError } = await context.supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) return json({ error: "Destiny could not delete the login account." }, 500);

    return json({ deleted: true });
  }),
};
