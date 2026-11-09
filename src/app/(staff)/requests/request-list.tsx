"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Phone } from "lucide-react";
import { useT, useStaffLocale } from "@/components/staff-locale";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cancelRequestAction, declineRequestAction } from "./actions";

export type RequestRow = {
  id: string;
  restaurant_id: string;
  restaurant: string;
  channel: "call" | "line";
  customer_name: string;
  phone: string | null;
  line_id: string | null;
  party_size: number;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: "pending" | "booked" | "declined" | "cancelled";
  decline_reason: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string;
  handled_by_name: string | null;
  reservation_id: string | null;
  reservation_ref: string | null;
};

const STATUS: Record<RequestRow["status"], { label: string; tone: "orange" | "green" | "red" | "slate" }> = {
  pending: { label: "Awaiting entry", tone: "orange" },
  booked: { label: "Keyed in", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export function RequestList({ rows, canHandle, userId, showRestaurant }: { rows: RequestRow[]; canHandle: boolean; userId: string; showRestaurant: boolean }) {
  const t = useT();
  const locale = useStaffLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const dateFmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : locale === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(t(done));
        router.refresh();
      } else toast.error(t(r.error ?? "Something went wrong"));
    });

  if (rows.length === 0) {
    return <Card className="px-4 py-10 text-center text-sm text-muted">{t("No requests here.")}</Card>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const s = STATUS[r.status];
        const [y, m, d] = r.requested_date.split("-").map(Number);
        return (
          <Card key={r.id} className="p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.tone}>{t(s.label)}</Badge>
                  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${r.channel === "line" ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800"}`}>
                    {r.channel === "line" ? <MessageCircle className="size-3" /> : <Phone className="size-3" />}
                    {r.channel === "line" ? "LINE" : t("Call")}
                  </span>
                  {showRestaurant ? <span className="text-xs text-muted">{r.restaurant}</span> : null}
                </div>
                <p className="font-medium text-slate-900">
                  {r.customer_name} <span className="font-normal text-muted">· {r.party_size} {t("guests")}</span>
                </p>
                <p className="text-sm tabular-nums text-slate-800">
                  {dateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)))} · <strong>{r.requested_time}</strong>
                </p>
                <p className="text-xs text-muted">
                  {[r.phone, r.line_id ? `LINE: ${r.line_id}` : null].filter(Boolean).join(" · ")}
                </p>
                {r.notes ? <p className="whitespace-pre-line text-sm text-slate-700">{r.notes}</p> : null}
                {r.status === "declined" && r.decline_reason ? <p className="text-sm text-red-700">{t("Reason")}: {r.decline_reason}</p> : null}
                <p className="text-xs text-muted">
                  {t("Logged by")} {r.created_by_name} · {timeFmt.format(new Date(r.created_at))}
                  {r.handled_by_name ? ` · ${t("handled by")} ${r.handled_by_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status === "booked" && r.reservation_id ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/reservations/${r.reservation_id}`}>{r.reservation_ref ?? t("Open reservation")}</Link>
                  </Button>
                ) : null}
                {r.status === "pending" && canHandle ? (
                  <>
                    <Button asChild size="sm">
                      <Link href={`/reservations/new?request=${r.id}`}>{t("Key into system")}</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt(t("Why can't it be booked? The Call Center will see this."), t("Fully booked"));
                        if (reason !== null) run(() => declineRequestAction(r.id, reason), "Request declined");
                      }}
                    >
                      {t("Decline")}
                    </Button>
                  </>
                ) : null}
                {r.status === "pending" && (canHandle || r.created_by === userId) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(t("Cancel this request?"))) run(() => cancelRequestAction(r.id), "Request cancelled");
                    }}
                  >
                    {t("Cancel request")}
                  </Button>
                ) : null}
                {r.status === "pending" ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/availability?restaurant=${r.restaurant_id}&date=${r.requested_date}&party=${r.party_size}`}>{t("Check tables")}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
