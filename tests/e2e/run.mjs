/**
 * Browser acceptance checks against a running app (pnpm dev) and the seeded local database.
 *   BASE_URL=http://localhost:3000 pnpm test:e2e
 * Covers: admin creates a restaurant (AC1), branch isolation in the UI (AC2), staff pages render (AC3/5/9/10),
 * mobile public booking + guest manage page (AC6/11), walk-in creation (AC8).
 */
import { chromium, devices } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "T23demo!2026";
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
async function login(email, ctxOpts = { viewport: { width: 1400, height: 900 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  return page;
}

const admin = await login("admin@t23.example.com");
const slug = `e2e-${Date.now().toString(36)}`;

await check("AC1 super admin creates a restaurant without code changes", async () => {
  await admin.goto(`${BASE}/restaurants`);
  await admin.getByRole("button", { name: /add restaurant/i }).click();
  await admin.fill("input[name=name]", "E2E Bistro");
  await admin.fill("input[name=slug]", slug);
  await admin.getByRole("button", { name: /create restaurant/i }).click();
  await admin.waitForURL(/\/restaurants\/[0-9a-f-]{36}/, { timeout: 30000 });
  const { data } = await service.from("restaurants").select("id, booking_policies(id), operating_hours(id)").eq("slug", slug).single();
  assert(data && data.operating_hours.length === 7, "restaurant defaults not created");
});

await check("AC3/5/9/10 staff pages render without errors", async () => {
  for (const p of ["/dashboard", "/reservations", "/calendar", "/floor-plan", "/waitlist", "/customers", "/reports", "/notifications", "/integrations", "/settings", "/audit-logs", "/users"]) {
    const r = await admin.goto(BASE + p);
    assert(r.status() === 200, `${p} returned ${r.status()}`);
  }
  assert(admin.errors.length === 0, admin.errors.join("; "));
});

const host = await login("host.capricci@t23.example.com");
await check("AC2 host only sees their branch and cannot open admin pages", async () => {
  await host.goto(`${BASE}/restaurants`);
  const body = await host.locator("main").innerText();
  assert(body.includes("Capricci") && !body.includes("Sushi Saryu") && !body.includes("E2E Bistro"), "other branches visible to host");
  await host.goto(`${BASE}/users`);
  assert(host.url().includes("/forbidden"), "host reached /users");
  await host.goto(`${BASE}/audit-logs`);
  assert(host.url().includes("/forbidden"), "host reached /audit-logs");
});

await check("AC8 host records a walk-in", async () => {
  await host.goto(`${BASE}/reservations/new?walkin=1`);
  await host.getByLabel("Guest name").fill("E2E Walk-in");
  await host.getByRole("button", { name: /create reservation/i }).click();
  await host.waitForURL(/\/reservations\/[0-9a-f-]{36}/, { timeout: 30000 });
});

await check("AC6/11 guest books on a phone and gets a manage page with QR", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/book/capricci?lang=th`, { timeout: 90000 });
  await page.locator("div.overflow-x-auto button").nth(5).click();
  await page.waitForTimeout(2500);
  await page.locator("div.grid.grid-cols-4 button").last().click();
  await page.getByRole("button", { name: /ถัดไป/ }).click();
  await page.fill("input[autocomplete=name]", "E2E Guest");
  await page.fill("input[autocomplete=tel]", `089${Date.now().toString().slice(-7)}`);
  await page.fill("input[autocomplete=email]", "e2e.guest@example.com");
  await page.locator("input[type=checkbox]").first().check();
  await page.getByRole("button", { name: /ยืนยันการจอง/ }).click();
  await page.waitForURL("**/reservation/**", { timeout: 60000 });
  assert(await page.locator("svg, img").count() > 0, "no QR on manage page");
});

await check("Public booking page is unavailable for inactive restaurants", async () => {
  await service.from("restaurants").update({ is_active: false }).eq("slug", slug);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const r = await page.goto(`${BASE}/book/${slug}`);
  assert(r.status() === 404, `expected 404, got ${r.status()}`);
});

// cleanup test data
await service.from("reservations").delete().in("customer_name", ["E2E Walk-in", "E2E Guest"]);
await service.from("restaurants").delete().eq("slug", slug);
await browser.close();

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
