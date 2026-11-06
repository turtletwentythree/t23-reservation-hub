"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { customerSchema } from "@/lib/validation/schemas";

export async function saveCustomerAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const input = customerSchema.parse(raw);
    const ctx = await assertPermission("customer.edit");
    const supabase = await createClient();
    const row = {
      ...input,
      phone: input.phone ?? null, email: input.email ?? null, birthday: input.birthday ?? null, vip_note: input.vip_note ?? null,
      allergies: input.allergies ?? null, dietary_preferences: input.dietary_preferences ?? null, special_requests: input.special_requests ?? null,
      internal_notes: input.internal_notes ?? null, line_user_id: input.line_user_id ?? null,
    };
    const { data, error } = id
      ? await supabase.from("customers").update(row).eq("id", id).select("id").single()
      : await supabase.from("customers").insert({ ...row, organization_id: ctx.organizationId }).select("id").single();
    if (error) throw new DomainError("validation", error.message);
    revalidatePath(`/customers/${data.id}`);
    revalidatePath("/customers");
    return ok({ id: data.id });
  } catch (e) {
    return fail(e);
  }
}

export async function setCustomerTagsAction(customerId: string, tagIds: string[]): Promise<ActionResult<undefined>> {
  try {
    z.string().uuid().parse(customerId);
    z.array(z.string().uuid()).max(30).parse(tagIds);
    await assertPermission("customer.edit");
    const supabase = await createClient();
    const { error } = await supabase.from("customer_tag_assignments").delete().eq("customer_id", customerId);
    if (error) throw new DomainError("validation", error.message);
    if (tagIds.length) {
      const { error: e2 } = await supabase.from("customer_tag_assignments").insert(tagIds.map((t) => ({ customer_id: customerId, tag_id: t })));
      if (e2) throw new DomainError("validation", e2.message);
    }
    revalidatePath(`/customers/${customerId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function createTagAction(name: string, color: string): Promise<ActionResult<undefined>> {
  try {
    const n = z.string().trim().min(1).max(40).parse(name);
    const c = z.string().regex(/^#[0-9a-fA-F]{6}$/).parse(color);
    const ctx = await assertPermission("customer.edit");
    const supabase = await createClient();
    const { error } = await supabase.from("customer_tags").insert({ organization_id: ctx.organizationId, name: n, color: c });
    if (error) throw new DomainError("validation", error.code === "23505" ? "Tag already exists" : error.message);
    revalidatePath("/customers");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function recordConsentAction(customerId: string, consentType: string, granted: boolean): Promise<ActionResult<undefined>> {
  try {
    z.string().uuid().parse(customerId);
    const type = z.enum(["data_processing", "marketing_email", "marketing_sms", "marketing_line", "birthday_offers"]).parse(consentType);
    const ctx = await assertPermission("customer.edit");
    const supabase = await createClient();
    const { error } = await supabase.from("customer_consents").insert({ customer_id: customerId, consent_type: type, granted, source: "staff", recorded_by: ctx.userId });
    if (error) throw new DomainError("validation", error.message);
    revalidatePath(`/customers/${customerId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function mergeCustomersAction(primaryId: string, duplicateId: string): Promise<ActionResult<undefined>> {
  try {
    z.string().uuid().parse(primaryId);
    z.string().uuid().parse(duplicateId);
    await assertPermission("customer.edit");
    const supabase = await createClient();
    const { error } = await supabase.rpc("merge_customers", { p_primary: primaryId, p_duplicate: duplicateId });
    if (error) throw new DomainError(error.code === "42501" ? "forbidden" : "validation", error.code === "42501" ? "Only managers and Super Admins can merge guests." : error.message);
    revalidatePath("/customers");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function anonymizeCustomerAction(customerId: string, note: string): Promise<ActionResult<undefined>> {
  try {
    z.string().uuid().parse(customerId);
    await assertPermission("customer.privacy");
    const supabase = await createClient();
    const { error } = await supabase.rpc("anonymize_customer", { p_customer_id: customerId, p_request_note: note.slice(0, 500) });
    if (error) throw new DomainError("forbidden", error.message);
    revalidatePath(`/customers/${customerId}`);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
