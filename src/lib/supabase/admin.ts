import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES RLS. Server-only (the `server-only` import makes
 * any client bundle that includes this file fail to build).
 * Use only for: public booking RPCs after validation, sending notifications,
 * Auth admin (inviting staff) after a super-admin check, cron jobs, webhooks.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
