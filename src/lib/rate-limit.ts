import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Returns true when the request is allowed. Backed by Postgres so it works across serverless instances. */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number, identity?: string): Promise<boolean> {
  const id = identity ?? (await clientIp());
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: `${bucket}:${id}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true; // fail open rather than lock out staff; errors are logged
  }
  return data === true;
}
