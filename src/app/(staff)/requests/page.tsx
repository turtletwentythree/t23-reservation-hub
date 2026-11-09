import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { pickParam, todayIn } from "@/lib/data/common";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/card";
import { LiveRefresh } from "@/components/live-refresh";
import { RequestForm } from "./request-form";
import { RequestList, type RequestRow } from "./request-list";

export const metadata = { title: "Booking requests" };

const STATUSES = ["pending", "booked", "declined", "cancelled", "all"] as const;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("request.create", "requests");
  const sp = await searchParams;
  const ids = ctx.branchIds;
  if (ids.length === 0) return <EmptyState title={t("No restaurant access")} />;

  const statusParam = pickParam(sp.status);
  const status = (STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as (typeof STATUSES)[number]) : "pending";
  const date = pickParam(sp.date) ?? "";
  const mine = pickParam(sp.mine) === "1";
  const canHandle = roleCan(ctx.role, "request.handle");
  const supabase = await createClient();

  let q = supabase.from("booking_requests").select("*").in("restaurant_id", ids).order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (date) q = q.eq("requested_date", date);
  if (mine) q = q.eq("created_by", ctx.userId);
  if (status === "pending") q = q.order("requested_date").order("requested_time");
  const [{ data: rows, error }, { data: pendingRows }] = await Promise.all([
    q,
    supabase.from("booking_requests").select("id, requested_date").in("restaurant_id", ids).eq("status", "pending"),
  ]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Booking requests")} />
        <EmptyState
          title={t("Booking requests are not set up yet")}
          description={t("Ask the Admin to run the latest database update (call-center-requests.sql) in Supabase, then reload this page.")}
        />
      </div>
    );
  }

  const userIds = [...new Set((rows ?? []).flatMap((r) => [r.created_by, r.handled_by]).filter((x): x is string => Boolean(x)))];
  const { data: users } = userIds.length ? await supabase.from("users").select("id, full_name, email").in("id", userIds) : { data: [] };
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name ?? u.email]));
  const restaurantName = new Map(ctx.restaurants.map((r) => [r.id, r.name]));
  const reservationIds = (rows ?? []).map((r) => r.reservation_id).filter((x): x is string => Boolean(x));
  const { data: reservations } = reservationIds.length
    ? await supabase.from("reservations").select("id, reference").in("id", reservationIds)
    : { data: [] };
  const refById = new Map((reservations ?? []).map((r) => [r.id, r.reference]));

  const today = todayIn();
  const pending = pendingRows ?? [];
  const list: RequestRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    restaurant_id: r.restaurant_id,
    restaurant: restaurantName.get(r.restaurant_id) ?? "—",
    channel: r.channel as "call" | "line",
    customer_name: r.customer_name,
    phone: r.phone,
    line_id: r.line_id,
    party_size: r.party_size,
    requested_date: r.requested_date,
    requested_time: r.requested_time.slice(0, 5),
    notes: r.notes,
    status: r.status as RequestRow["status"],
    decline_reason: r.decline_reason,
    created_at: r.created_at,
    created_by: r.created_by,
    created_by_name: r.created_by ? (userName.get(r.created_by) ?? "—") : "—",
    handled_by_name: r.handled_by ? (userName.get(r.handled_by) ?? "—") : null,
    reservation_id: r.reservation_id,
    reservation_ref: r.reservation_id ? (refById.get(r.reservation_id) ?? null) : null,
  }));

  const tab = (s: string, label: string) => {
    const params = new URLSearchParams(Object.entries({ status: s, date, mine: mine ? "1" : "" }).filter(([, v]) => v) as [string, string][]);
    return (
      <Link
        key={s}
        href={`/requests?${params}`}
        className={`rounded-lg px-3 py-1.5 text-sm ${status === s ? "bg-brand-500 text-white" : "bg-white text-slate-700 hover:bg-brand-50 border"}`}
      >
        {t(label)}
      </Link>
    );
  };

  const prefill = {
    restaurant_id: [pickParam(sp.restaurant), ctx.selectedBranch].find((x) => x && x !== "all" && ids.includes(x)) ?? ids[0],
    requested_date: pickParam(sp.rdate) ?? today,
    requested_time: pickParam(sp.time) ?? "",
    party_size: Number(pickParam(sp.party) ?? 2) || 2,
  };

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["booking_requests"]} />
      <PageHeader
        title={t("Booking requests")}
        description={canHandle
          ? t("Requests from the Call Center (phone and LINE). Press Book table to key each one into the system.")
          : t("Log phone and LINE booking requests here. The store books the table and you can follow the status.")}
      />

      <div className={canHandle ? "space-y-3" : "grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]"}>
        {canHandle ? null : <Card className="h-fit">
          <CardContent className="pt-4">
            <h2 className="mb-3 font-semibold text-slate-900">{t("New booking request")}</h2>
            <RequestForm restaurants={ctx.restaurants.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, name: r.name }))} initial={prefill} />
          </CardContent>
        </Card>}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {tab("pending", `${t("Awaiting entry")} (${pending.length})`)}
            {tab("booked", "Keyed in")}
            {tab("all", "All")}
          </div>
          <RequestList rows={list} canHandle={canHandle} userId={ctx.userId} showRestaurant={ids.length > 1} />
        </div>
      </div>
    </div>
  );
}
