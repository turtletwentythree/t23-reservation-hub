"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/domain/reservation-service";
import { hashSecret, randomSecret } from "@/lib/tokens";
import { webhookSecret } from "@/lib/integrations/webhooks";

const done = () => revalidatePath("/settings");

export async function saveSourceAction(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const s = z.object({ id: z.string().uuid().optional(), code: z.string().regex(/^[a-z0-9_]{2,30}$/), name: z.string().trim().min(1).max(60), is_active: z.boolean() }).parse(raw);
    const ctx = await assertPermission("settings.manage");
    const supabase = await createClient();
    const { error } = s.id
      ? await supabase.from("booking_sources").update({ name: s.name, is_active: s.is_active }).eq("id", s.id)
      : await supabase.from("booking_sources").insert({ organization_id: ctx.organizationId, code: s.code, name: s.name, is_active: s.is_active });
    if (error) throw new DomainError("validation", error.code === "23505" ? "Code already exists" : error.message);
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function createApiKeyAction(raw: unknown): Promise<ActionResult<{ key: string }>> {
  try {
    const k = z.object({ name: z.string().trim().min(1).max(60), restaurant_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)), scopes: z.array(z.enum(["availability:read", "reservations:read", "reservations:write"])).min(1) }).parse(raw);
    const ctx = await assertPermission("settings.manage", k.restaurant_id);
    const key = randomSecret("t23", 30);
    const supabase = await createClient();
    const { error } = await supabase.from("api_keys").insert({ organization_id: ctx.organizationId, restaurant_id: k.restaurant_id ?? null, name: k.name, key_prefix: key.slice(0, 10), key_hash: hashSecret(key), scopes: k.scopes, created_by: ctx.userId });
    if (error) throw new DomainError("validation", error.message);
    done();
    return ok({ key }); // shown once; only the hash is stored
  } catch (e) {
    return fail(e);
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("settings.manage");
    const supabase = await createClient();
    await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(id));
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

function assertPublicHttps(url: string) {
  const u = new URL(url);
  const h = u.hostname;
  if (u.protocol !== "https:") throw new DomainError("validation", "Webhook URL must use https");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(h) || h.endsWith(".internal") || h.endsWith(".local")) {
    throw new DomainError("validation", "Webhook URL must be a public host");
  }
}

export async function createWebhookAction(raw: unknown): Promise<ActionResult<{ secret: string }>> {
  try {
    const w = z.object({ url: z.string().url().max(500), events: z.array(z.enum(["reservation.created", "reservation.updated", "reservation.cancelled"])).min(1) }).parse(raw);
    assertPublicHttps(w.url);
    const ctx = await assertPermission("settings.manage");
    const supabase = await createClient();
    const { data, error } = await supabase.from("webhook_endpoints").insert({ organization_id: ctx.organizationId, url: w.url, events: w.events, secret_hash: "pending", created_by: ctx.userId }).select("id").single();
    if (error) throw new DomainError("validation", error.message);
    const secret = webhookSecret(data.id);
    await supabase.from("webhook_endpoints").update({ secret_hash: hashSecret(secret) }).eq("id", data.id);
    done();
    return ok({ secret });
  } catch (e) {
    return fail(e);
  }
}

export async function toggleWebhookAction(id: string, active: boolean): Promise<ActionResult<undefined>> {
  try {
    await assertPermission("settings.manage");
    const supabase = await createClient();
    await supabase.from("webhook_endpoints").update({ is_active: active }).eq("id", z.string().uuid().parse(id));
    done();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function retentionAction(months: number, dryRun: boolean): Promise<ActionResult<{ customers: number; notification_logs: number; cutoff: string }>> {
  try {
    const m = z.number().int().min(6).max(240).parse(months);
    await assertPermission("customer.privacy");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("apply_retention", { p_months: m, p_dry_run: dryRun });
    if (error) throw new DomainError("forbidden", error.message);
    return ok(data as { customers: number; notification_logs: number; cutoff: string });
  } catch (e) {
    return fail(e);
  }
}
