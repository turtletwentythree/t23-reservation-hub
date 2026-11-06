"use server";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { inviteUserSchema, updateUserAccessSchema } from "@/lib/validation/schemas";

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
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (error || !data.user) throw new DomainError("validation", error?.message ?? "Could not create user");
    const supabase = await createClient();
    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: data.user.id, organization_id: ctx.organizationId, role: input.role });
    if (roleErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new DomainError("validation", roleErr.message);
    }
    await supabase.from("users").update({ full_name: input.full_name }).eq("id", data.user.id);
    if (input.restaurant_ids.length) {
      await supabase.from("restaurant_user_access").insert(input.restaurant_ids.map((rid) => ({ user_id: data.user!.id, restaurant_id: rid })));
    }
    revalidatePath("/users");
    return ok({ id: data.user.id });
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
