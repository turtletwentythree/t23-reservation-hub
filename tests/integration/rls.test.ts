/**
 * Database permission tests (acceptance criteria 2, 4, 10, 12).
 * Run against the local Supabase stack seeded with supabase/seed.sql:
 *   pnpm db:reset && pnpm test:integration
 * Every query goes through PostgREST with a real user JWT, so RLS is exercised exactly as in production.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "T23demo!2026";

const R = {
  capricci: "10000000-0000-4000-8000-000000000001",
  lawoi: "10000000-0000-4000-8000-000000000002",
  kappo: "10000000-0000-4000-8000-000000000003",
  bly: "10000000-0000-4000-8000-000000000004",
  saryu: "10000000-0000-4000-8000-000000000005",
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
async function signIn(email: string) {
  const c = createClient(URL, ANON, opts);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
async function visibleRestaurants(c: SupabaseClient) {
  const { data, error } = await c.from("restaurants").select("id");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.id));
}

let admin: SupabaseClient, group: SupabaseClient, manager: SupabaseClient, host: SupabaseClient, viewer: SupabaseClient, saryuHost: SupabaseClient;
const anon = createClient(URL, ANON, opts);
const service = createClient(URL, SERVICE, opts);
const created: string[] = [];
const testDate = (() => {
  const d = new Date(Date.now() + 20 * 86400_000);
  // pick a Wednesday so every branch is open
  while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

beforeAll(async () => {
  if (!ANON || !SERVICE) throw new Error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.local)");
  [admin, group, manager, host, viewer, saryuHost] = await Promise.all([
    signIn("admin@t23.example.com"),
    signIn("group.manager@t23.example.com"),
    signIn("manager.capricci@t23.example.com"),
    signIn("host.capricci@t23.example.com"),
    signIn("viewer@t23.example.com"),
    signIn("host.saryu@t23.example.com"),
  ]);
});

afterAll(async () => {
  if (created.length) await service.from("reservations").delete().in("id", created);
});

async function tableOf(restaurantId: string, name: string) {
  const { data } = await service.from("tables").select("id").eq("restaurant_id", restaurantId).eq("label", name).single();
  return data!.id as string;
}

describe("branch isolation", () => {
  it("super admin sees all 8 restaurants", async () => {
    expect((await visibleRestaurants(admin)).size).toBe(8);
  });
  it("group manager sees only the four assigned branches", async () => {
    const ids = await visibleRestaurants(group);
    expect(ids.size).toBe(4);
    expect(ids.has(R.capricci) && ids.has(R.lawoi) && ids.has(R.bly)).toBe(true);
    expect(ids.has(R.saryu)).toBe(false);
  });
  it("Capricci host sees only Capricci reservations", async () => {
    const { data, error } = await host.from("reservations").select("restaurant_id").limit(1000);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((r) => r.restaurant_id))).toEqual(new Set([R.capricci]));
  });
  it("Capricci host cannot read a Sushi Saryu reservation by id", async () => {
    const { data: other } = await service.from("reservations").select("id").eq("restaurant_id", R.saryu).limit(1).single();
    const { data } = await host.from("reservations").select("id").eq("id", other!.id);
    expect(data).toEqual([]);
  });
  it("Saryu host cannot see Capricci tables", async () => {
    const { data } = await saryuHost.from("tables").select("id").eq("restaurant_id", R.capricci);
    expect(data).toEqual([]);
  });
  it("audit logs are hidden from hosts", async () => {
    const { data } = await host.from("audit_logs").select("id").limit(5);
    expect(data).toEqual([]);
  });
});

describe("anonymous access", () => {
  for (const table of ["restaurants", "reservations", "customers", "tables", "payments", "audit_logs", "api_keys"]) {
    it(`anon cannot read ${table}`, async () => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
  }
  it("anon cannot call create_reservation", async () => {
    const { error } = await anon.rpc("create_reservation", { payload: {} });
    expect(error).not.toBeNull();
  });
});

describe("write permissions", () => {
  it("viewer cannot create a reservation", async () => {
    const { error } = await viewer.rpc("create_reservation", {
      payload: { restaurant_id: R.capricci, customer_name: "Viewer Test", reservation_date: testDate, reservation_time: "18:00", party_size: 2, duration_minutes: 90 },
    });
    expect(error).not.toBeNull();
  });
  it("viewer cannot update a reservation", async () => {
    const { data: r } = await service.from("reservations").select("id, guest_notes").eq("restaurant_id", R.capricci).limit(1).single();
    await viewer.from("reservations").update({ guest_notes: "hacked" }).eq("id", r!.id);
    const { data: after } = await service.from("reservations").select("guest_notes").eq("id", r!.id).single();
    expect(after!.guest_notes).toBe(r!.guest_notes);
  });
  it("Capricci host cannot create a reservation at Lawoi", async () => {
    const { error } = await host.rpc("create_reservation", {
      payload: { restaurant_id: R.lawoi, customer_name: "Cross Branch", reservation_date: testDate, reservation_time: "18:00", party_size: 2, duration_minutes: 90 },
    });
    expect(error).not.toBeNull();
  });
  it("host cannot edit restaurant settings; manager can", async () => {
    const { data: before } = await service.from("restaurants").select("phone").eq("id", R.capricci).single();
    await host.from("restaurants").update({ phone: "000" }).eq("id", R.capricci);
    const { data: mid } = await service.from("restaurants").select("phone").eq("id", R.capricci).single();
    expect(mid!.phone).toBe(before!.phone);
    const { error } = await manager.from("restaurants").update({ phone: before!.phone }).eq("id", R.capricci).select();
    expect(error).toBeNull();
  });
  it("only super admin can create restaurants", async () => {
    const row = { organization_id: "00000000-0000-4000-8000-000000000001", name: "RLS Test", slug: `rls-test-${Date.now()}` };
    const { error: e1 } = await manager.from("restaurants").insert(row);
    expect(e1).not.toBeNull();
    const { data, error: e2 } = await admin.from("restaurants").insert(row).select("id").single();
    expect(e2).toBeNull();
    await service.from("restaurants").delete().eq("id", data!.id);
  });
  it("users cannot escalate their own role", async () => {
    const { data: me } = await host.auth.getUser();
    await host.from("user_roles").update({ role: "super_admin" }).eq("user_id", me.user!.id);
    await host.from("user_roles").insert({ user_id: me.user!.id, organization_id: "00000000-0000-4000-8000-000000000001", role: "super_admin" });
    const { data } = await service.from("user_roles").select("role").eq("user_id", me.user!.id);
    expect(data!.some((r) => r.role === "super_admin")).toBe(false);
  });
});

describe("double-booking prevention (database level)", () => {
  it("host can book a table, and an overlapping booking on the same table is rejected", async () => {
    const t1 = await tableOf(R.capricci, "T7");
    const base = { restaurant_id: R.capricci, reservation_date: testDate, party_size: 6, duration_minutes: 120, table_ids: [t1], status: "confirmed" };
    const { data: a, error: e1 } = await host.rpc("create_reservation", { payload: { ...base, customer_name: "Overlap A", phone: "0811111111", reservation_time: "11:30" } });
    expect(e1).toBeNull();
    created.push((a as { id: string }).id);
    const { error: e2 } = await host.rpc("create_reservation", { payload: { ...base, customer_name: "Overlap B", phone: "0822222222", reservation_time: "12:30" } });
    expect(e2).not.toBeNull();
    expect(e2!.code).toBe("23P01"); // exclusion_violation
  });
  it("cancelling frees the table for a new booking", async () => {
    const t1 = await tableOf(R.capricci, "T7");
    await host.from("reservations").update({ status: "cancelled", cancellation_reason: "test" }).eq("id", created[0]);
    const { data, error } = await host.rpc("create_reservation", {
      payload: { restaurant_id: R.capricci, reservation_date: testDate, party_size: 6, duration_minutes: 120, table_ids: [t1], status: "confirmed", customer_name: "After Cancel", phone: "0833333333", reservation_time: "12:00" },
    });
    expect(error).toBeNull();
    created.push((data as { id: string }).id);
  });
  it("party larger than table capacity is rejected unless overridden", async () => {
    const t = await tableOf(R.capricci, "T1");
    const { error } = await host.rpc("create_reservation", {
      payload: { restaurant_id: R.capricci, reservation_date: testDate, party_size: 6, duration_minutes: 90, table_ids: [t], customer_name: "Too Big", phone: "0844444444", reservation_time: "19:30" },
    });
    expect(error?.hint).toBe("capacity_conflict");
  });
  it("audit log and reservation history record the change", async () => {
    const id = created[created.length - 1];
    const { data: hist } = await admin.from("reservation_history").select("id").eq("reservation_id", id);
    expect(hist!.length).toBeGreaterThan(0);
    const { data: audit } = await admin.from("audit_logs").select("id, actor_id").eq("entity_id", id);
    expect(audit!.length).toBeGreaterThan(0);
    expect(audit![0].actor_id).not.toBeNull();
  });
});
