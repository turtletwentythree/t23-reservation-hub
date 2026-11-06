import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getReservationFormData } from "@/lib/data/reservation-form-data";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { QrCode } from "@/components/qr-code";
import { manageUrl } from "@/lib/tokens";
import { gatewayStatus } from "@/lib/integrations/payments/registry";
import { STATUS_META } from "@/lib/domain/status";
import { formatMoney } from "@/lib/utils";
import { StatusActions } from "./status-actions";
import { PaymentPanel } from "./payment-panel";
import { ReservationForm } from "../reservation-form";
import { RetryNotificationButton } from "@/app/(staff)/notifications/retry-button";

export default async function ReservationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const ctx = await requireStaff("reservation.view");
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reservations")
    .select("*, restaurants(name, currency, timezone), customers(id, full_name, is_vip, total_visits, total_no_shows, allergies, internal_notes), booking_sources(name), booking_types(name), reservation_tables(table_id, tables(label, max_capacity))")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: history }, { data: payments }, { data: logs }, { data: actors }] = await Promise.all([
    supabase.from("reservation_history").select("*").eq("reservation_id", id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*, refunds(*)").eq("reservation_id", id).order("created_at"),
    supabase.from("notification_logs").select("id, event, channel, recipient, status, error, attempts, created_at").eq("reservation_id", id).order("created_at", { ascending: false }),
    supabase.from("users").select("id, full_name, email"),
  ]);
  const actorName = new Map((actors ?? []).map((u) => [u.id, u.full_name ?? u.email]));
  const canWrite = roleCan(ctx.role, "reservation.write");
  const currency = r.restaurants?.currency ?? "THB";
  const link = manageUrl(r.reference, r.id);

  if (edit === "1" && canWrite) {
    const formData = await getReservationFormData({ ...ctx, branchIds: [r.restaurant_id] });
    return (
      <div className="mx-auto max-w-3xl">
        <Link href={`/reservations/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-slate-800"><ArrowLeft className="size-4" /> Back</Link>
        <h1 className="mb-4 text-xl font-semibold">Edit {r.reference}</h1>
        <Card className="p-4 sm:p-6">
          <ReservationForm
            {...formData}
            restaurants={[{ id: r.restaurant_id, name: r.restaurants?.name ?? "" }]}
            initial={{
              id: r.id,
              restaurant_id: r.restaurant_id,
              customer_id: r.customer_id ?? undefined,
              customer_name: r.customer_name,
              phone: r.phone ?? "",
              email: r.email ?? "",
              language: r.language as "en",
              reservation_date: r.reservation_date,
              reservation_time: r.reservation_time.slice(0, 5),
              party_size: r.party_size,
              duration_minutes: r.duration_minutes,
              booking_source_id: r.booking_source_id ?? "",
              booking_type_id: r.booking_type_id ?? "",
              table_ids: r.reservation_tables.map((t) => t.table_id),
              special_occasion: r.special_occasion ?? "",
              dietary_requirements: r.dietary_requirements ?? "",
              allergies: r.allergies ?? "",
              guest_notes: r.guest_notes ?? "",
              internal_notes: r.internal_notes ?? "",
              deposit_amount: Number(r.deposit_amount),
              status: "confirmed",
              is_walk_in: r.is_walk_in,
            }}
          />
        </Card>
      </div>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ["Restaurant", r.restaurants?.name],
    ["Date & time", `${r.reservation_date} · ${r.reservation_time.slice(0, 5)} (${r.duration_minutes} min)`],
    ["Guests", r.party_size],
    ["Tables", r.reservation_tables.length ? r.reservation_tables.map((t) => `${t.tables?.label} (${t.tables?.max_capacity})`).join(" + ") : <span className="text-amber-700">Unassigned</span>],
    ["Source", r.booking_sources?.name ?? "—"],
    ["Booking type", (r.booking_types?.name as Record<string, string> | undefined)?.en ?? "—"],
    ["Phone", r.phone ?? "—"],
    ["Email", r.email ?? "—"],
    ["Language", r.language.toUpperCase()],
    ["Special occasion", r.special_occasion ?? "—"],
    ["Dietary", r.dietary_requirements ?? "—"],
    ["Allergies", r.allergies ? <span className="font-medium text-amber-700">⚠ {r.allergies}</span> : "—"],
    ["Guest notes", r.guest_notes ?? "—"],
    ["Internal notes", r.internal_notes ?? "—"],
    ["Deposit", `${formatMoney(r.deposit_amount, currency)} · ${r.payment_status.replace("_", " ")}`],
    ["Created", `${new Date(r.created_at).toLocaleString("en-GB", { timeZone: r.restaurants?.timezone })} by ${r.created_by ? actorName.get(r.created_by) ?? "staff" : "online booking"}`],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/reservations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-slate-800"><ArrowLeft className="size-4" /> Reservations</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{r.customers?.is_vip ? "★ " : ""}{r.customer_name}</h1>
            <StatusBadge status={r.status} />
            {r.is_walk_in ? <Badge tone="orange">Walk-in</Badge> : null}
          </div>
          <p className="font-mono text-sm text-muted">{r.reference}</p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusActions id={r.id} status={r.status} canDelete={roleCan(ctx.role, "reservation.delete")} />
            <Button asChild size="sm" variant="outline"><Link href={`/reservations/${id}?edit=1`}><Pencil /> Edit</Link></Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="pt-4">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b border-dashed py-1.5 text-sm">
                    <dt className="w-32 shrink-0 text-muted">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.status === "cancelled" && r.cancellation_reason ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">Cancellation reason: {r.cancellation_reason}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {(history ?? []).map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand-400" />
                    <p className="font-medium">
                      {h.change_type === "created" ? "Created" : h.change_type === "status_changed" ? `Status: ${STATUS_META[h.from_status!]?.label} → ${STATUS_META[h.to_status!]?.label}` : h.change_type === "tables_changed" ? "Tables changed" : "Updated"}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(h.created_at).toLocaleString("en-GB", { timeZone: r.restaurants?.timezone })} · {h.changed_by ? actorName.get(h.changed_by) ?? "staff" : h.actor_label ?? "system"}
                    </p>
                    {h.change_type === "updated" ? (
                      <ul className="mt-1 text-xs text-slate-600">
                        {Object.entries(h.changes as Record<string, { from: unknown; to: unknown }>).filter(([k]) => k !== "status").map(([k, c]) => (
                          <li key={k}><span className="font-medium">{k.replace(/_/g, " ")}</span>: {String(c?.from ?? "—")} → {String(c?.to ?? "—")}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent>
              {(logs ?? []).length === 0 ? <p className="text-sm text-muted">No notifications for this booking.</p> : (
                <ul className="divide-y text-sm">
                  {(logs ?? []).map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{l.event.replace(/_/g, " ")} · {l.channel} → <span className="text-muted">{l.recipient}</span></span>
                      <span className="flex items-center gap-2">
                        <Badge tone={l.status === "sent" ? "green" : l.status === "not_configured" ? "slate" : l.status === "failed" ? "red" : "yellow"}>{l.status.replace("_", " ")}</Badge>
                        {l.status === "failed" || l.status === "not_configured" ? <RetryNotificationButton id={l.id} /> : null}
                      </span>
                      {l.error ? <p className="w-full text-xs text-muted">{l.error}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {r.customers ? (
            <Card>
              <CardHeader><CardTitle>Guest profile</CardTitle><Link className="text-xs font-medium text-brand-600 hover:underline" href={`/customers/${r.customers.id}`}>Open</Link></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{r.customers.total_visits} visits · {r.customers.total_no_shows} no-shows</p>
                {r.customers.allergies ? <p className="text-amber-700">⚠ {r.customers.allergies}</p> : null}
                {r.customers.internal_notes ? <p className="text-muted">{r.customers.internal_notes}</p> : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Payment & deposit</CardTitle></CardHeader>
            <CardContent>
              <PaymentPanel
                reservationId={r.id}
                currency={currency}
                deposit={Number(r.deposit_amount)}
                payments={(payments ?? []).map((p) => ({ ...p, amount: Number(p.amount), refunds: (p.refunds ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) }))}
                canRecord={roleCan(ctx.role, "payment.record")}
                canRefund={roleCan(ctx.role, "payment.refund")}
                gateways={gatewayStatus()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Guest confirmation</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-center">
              <QrCode value={link} />
              <p className="break-all text-left text-xs text-muted">{link}</p>
              <p className="text-left text-xs text-muted">Share with the guest to view, modify or cancel within policy.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
