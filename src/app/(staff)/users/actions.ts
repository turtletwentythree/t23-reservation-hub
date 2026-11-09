"use server";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { inviteUserSchema, updateUserAccessSchema } from "@/lib/validation/schemas";

/** Finds an Authentication login by email (the Auth admin API has no lookup by email, so list the pages). */
async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === want);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Creates a staff account. Only a Super Admin may call this; the check happens here
 * (server-side) before the service-role client is used for the Auth admin API.
 * Role and branch rows are then written with the admin's own session so RLS applies.
 */
export async function createUserAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = inviteUserSchema.parse(raw);
    const ctx = await assertPermission("user.manage");
    const admin = createAdminClient();
    const created = await admin.auth.admin.createUser({
      email: input.email,
      // Without a password the account can only sign in with Microsoft 365 (same email).
      password: input.password ?? `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    let userId = created.data.user?.id ?? "";
    let wasExisting = false;
    if (created.error || !created.data.user) {
      const exists = /already (been )?registered|already exists|email_exists/i.test(`${created.error?.message ?? ""} ${(created.error as { code?: string } | null)?.code ?? ""}`);
      if (!exists) throw new DomainError("validation", created.error?.message ?? "Could not create user");
      // The login already exists in Authentication (for example from an earlier Microsoft 365 attempt) but has no staff access yet: reuse it.
      const found = await findAuthUserByEmail(admin, input.email);
      if (!found) throw new DomainError("validation", created.error?.message ?? "Could not create user");
      userId = found.id;
      wasExisting = true;
      const { data: hasRole } = await createAdminClient().from("user_roles").select("user_id").eq("user_id", found.id).eq("organization_id", ctx.organizationId).maybeSingle();
      if (hasRole) throw new DomainError("validation", "This email already has access. Find it in the list and press Edit.");
      // Optional password for the existing login.
      if (input.password) await admin.auth.admin.updateUserById(found.id, { password: input.password, email_confirm: true });
    }
    // Make sure the profile row exists (the sign-up trigger can be missing); user_roles points at it.
    const { error: profileErr } = await admin.from("users").upsert({ id: userId, email: input.email, full_name: input.full_name }, { onConflict: "id" });
    if (profileErr) {
      if (!wasExisting) await admin.auth.admin.deleteUser(userId);
      throw new DomainError("validation", profileErr.message);
    }
    const supabase = await createClient();
    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, organization_id: ctx.organizationId, role: input.role });
    if (roleErr) {
      if (!wasExisting) await admin.auth.admin.deleteUser(userId);
      throw new DomainError("validation", roleErr.message);
    }
    await supabase.from("users").update({ full_name: input.full_name }).eq("id", userId);
    if (input.restaurant_ids.length) {
      await supabase.from("restaurant_user_access").upsert(input.restaurant_ids.map((rid) => ({ user_id: userId, restaurant_id: rid })), { onConflict: "user_id,restaurant_id", ignoreDuplicates: true });
    }
    revalidatePath("/users");
    return ok({ id: userId });
  } catch (e) {
    return fail(e);
  }
}

export async function updateUserAction(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const input = updateUserAccessSchema.parse(raw);
    const ctx = await assertPermission("user.manage");
    if (input.user_id === ctx.userId && (input.role !== "super_admin" || !input.is_active)) {
      throw new DomainError("validation", "You cannot remove your own Super Admin access or deactivate yourself.");
    }
    const supabase = await createClient();
    const { error: e1 } = await supabase.from("users").update({ full_name: input.full_name, is_active: input.is_active }).eq("id", input.user_id);
    if (e1) throw new DomainError("validation", e1.message);
    const { error: e2 } = await supabase.from("user_roles").upsert({ user_id: input.user_id, organization_id: ctx.organizationId, role: input.role }, { onConflict: "user_id,organization_id" });
    if (e2) throw new DomainError("validation", e2.message);
    const { data: current } = await supabase.from("restaurant_user_access").select("restaurant_id").eq("user_id", input.user_id);
    const have = new Set((current ?? []).map((c) => c.restaurant_id));
    const want = new Set(input.restaurant_ids);
    const toRemove = [...have].filter((x) => !want.has(x));
    const toAdd = [...want].filter((x) => !have.has(x));
    if (toRemove.length) await supabase.from("restaurant_user_access").delete().eq("user_id", input.user_id).in("restaurant_id", toRemove);
    if (toAdd.length) await supabase.from("restaurant_user_access").insert(toAdd.map((rid) => ({ user_id: input.user_id, restaurant_id: rid })));
    if (!input.is_active) {
      // Revoke sessions of deactivated users (RLS already denies them because helpers require is_active).
      await createAdminClient().auth.admin.signOut(input.user_id).catch(() => undefined);
    }
    revalidatePath("/users");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
