import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";

export type ApiKeyContext = { id: string; organizationId: string; restaurantId: string | null; scopes: string[] };

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Authenticates `Authorization: Bearer t23_...` API keys (hashed at rest), enforces scope and per-key rate limit. */
export async function authenticateApiKey(req: Request, scope: string): Promise<ApiKeyContext | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith("t23_")) return apiError(401, "unauthorized", "Missing or invalid API key");
  const admin = createAdminClient();
  const { data } = await admin.from("api_keys").select("id, organization_id, restaurant_id, scopes, revoked_at").eq("key_hash", hashSecret(key)).maybeSingle();
  if (!data || data.revoked_at) return apiError(401, "unauthorized", "Missing or invalid API key");
  if (!data.scopes.includes(scope)) return apiError(403, "forbidden", `API key lacks scope ${scope}`);
  if (!(await rateLimit("api", 300, 60, data.id))) return apiError(429, "rate_limited", "Too many requests");
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id, organizationId: data.organization_id, restaurantId: data.restaurant_id, scopes: data.scopes };
}

export async function resolveRestaurant(ctx: ApiKeyContext, slug: string | null) {
  if (!slug) return null;
  const { data } = await createAdminClient().from("restaurants").select("id, name, slug, timezone, currency, is_active, organization_id").eq("slug", slug).maybeSingle();
  if (!data || data.organization_id !== ctx.organizationId || !data.is_active) return null;
  if (ctx.restaurantId && ctx.restaurantId !== data.id) return null;
  return data;
}
