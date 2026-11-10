import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Info, PhoneCall, Users, UtensilsCrossed } from "lucide-react";
import type { Translate } from "@/lib/i18n/staff";
import type { Dashboard, GuestType, MonthStats } from "@/lib/domain/dashboard";
import { GUEST_TYPES } from "@/lib/domain/dashboard";
import type { CapacityStatus } from "@/lib/domain/capacity-check";
import { CUSTOMER_TYPE_LABELS, splitCustomerType } from "@/lib/domain/request-tags";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { cn } from "@/lib/utils";

const TYPE_BG: Record<GuestType, string> = { internal: "bg-slate-500", kol: "bg-purple-500", media: "bg-sky-500", other: "bg-amber-400" };
const TYPE_PILL: Record<GuestType, string> = { internal: "bg-slate-100 text-slate-700", kol: "bg-purple-100 text-purple-800", media: "bg-sky-100 text-sky-800", other: "bg-amber-100 text-amber-800" };
const STATUS_BADGE: Record<CapacityStatus, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  full: "bg-amber-100 text-amber-800",
  over: "bg-red-100 text-red-700",
  closed: "bg-slate-100 text-slate-500",
};
const STATUS_TEXT: Record<CapacityStatus, string> = { ok: "Seats available", full: "Day full", over: "Over capacity", closed: "Closed" };
const TONE: Record<"red" | "amber" | "blue", { box: string; icon: string }> = {
  red: { box: "border-red-200 bg-red-50", icon: "text-red-600" },
  amber: { box: "border-amber-200 bg-amber-50", icon: "text-amber-600" },
  blue: { box: "border-sky-200 bg-sky-50", icon: "text-sky-600" },
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fillColor = (s: CapacityStatus, p: number) => (s === "over" ? "bg-red-500" : s === "full" || p >= 90 ? "bg-amber-500" : "bg-brand-500");

export interface DashboardViewProps {
  data: Dashboard;
  t: Translate;
  dateLocale: string;
  restaurant: { id: string; name: string };
  restaurants: { id: string; name: string }[];
  canHandle: boolean;
}

function Tile({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</p>
      <div className="mt-1.5">{children}</div>
    </Card>
  );
}

function Delta({ now, before, invert, unit = "" }: { now: number; before: number; invert?: boolean; unit?: string }) {
  if (!before && !now) return null;
  const diff = now - before;
  if (Math.abs(diff) < 0.05) return <span className="text-xs text-muted">=</span>;
  const good = invert ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  const shown = unit === "%" ? `${Math.abs(diff).toFixed(1)}%` : Math.abs(Math.round(diff)).toLocaleString();
  return (
    <span className={cn("inline-flex items-center text-xs font-medium", good ? "text-emerald-700" : "text-red-600")}>
      <Icon className="size-3.5" />{shown}
    </span>
  );
}

function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DashboardView({ data, t, dateLocale, restaurant, restaurants, canHandle }: DashboardViewProps) {
  const d = data.day;
  const fmt = (x: string, o: Intl.DateTimeFormatOptions) => new Date(`${x}T12:00:00Z`).toLocaleDateString(dateLocale, { timeZone: "UTC", ...o });
  const typeName = (k: GuestType) => (k === "other" ? t("Other") : CUSTOMER_TYPE_LABELS[k]);
  const href = (over: Record<string, string>) => `/dashboard?${new URLSearchParams({ restaurant: restaurant.id, date: data.date, ...over })}`;
  const shift = (n: number) => { const x = new Date(`${data.date}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dayWord = data.isToday ? t("today") : t("this day");
  const dayPct = pct(d.guests, d.seats);
  const maxSlot = Math.max(1, d.seats, ...data.slots.map((s) => s.inHouse));
  const maxOutlook = Math.max(1, ...data.outlook.map((o) => Math.max(o.seats, o.total + o.waiting)));
  const m = data.thisMonth;
  const lm = data.lastMonth;
  const maxWeekday = Math.max(1, ...data.weekdays.map((w) => w.avg));
  const ago = (iso: string) => {
    const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600_000);
    return h < 1 ? `${Math.max(1, Math.round(h * 60))} ${t("min")}` : h < 48 ? `${Math.round(h)} ${t("hr")}` : `${Math.round(h / 24)} ${t("days")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header: restaurant and day */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t("Dashboard")} · {restaurant.name}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {fmt(data.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {data.isToday ? <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">{t("Today")}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline"><Link href={href({ date: shift(-1) })} aria-label={t("Previous day")}><ChevronLeft /></Link></Button>
          <AutoSubmitForm className="flex items-center gap-2">
            <input type="hidden" name="restaurant" value={restaurant.id} />
            <Input type="date" name="date" defaultValue={data.date} className="h-8 w-40" aria-label={t("Date")} />
          </AutoSubmitForm>
          <Button asChild size="sm" variant="outline"><Link href={href({ date: shift(1) })} aria-label={t("Next day")}><ChevronRight /></Link></Button>
          {!data.isToday ? <Button asChild size="sm" variant="ghost"><Link href={`/dashboard?restaurant=${restaurant.id}`}>{t("Today")}</Link></Button> : null}
          {restaurants.length > 1 ? (
            <AutoSubmitForm>
              <input type="hidden" name="date" value={data.date} />
              <Select name="restaurant" defaultValue={restaurant.id} className="h-8 w-48" aria-label={t("Restaurant")}>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </AutoSubmitForm>
          ) : null}
        </div>
      </div>

      {/* 1. Key numbers for the day */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Users className="size-3.5" />} label={`${t("Guests booked")} ${dayWord}`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{d.guests}<span className="text-base font-normal text-muted"> / {d.seats}</span></p>
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS_BADGE[d.status])}>{t(STATUS_TEXT[d.status])}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", fillColor(d.status, dayPct))} style={{ width: `${Math.min(100, dayPct)}%` }} /></div>
          <p className="mt-1.5 text-xs text-muted">
            {d.status === "closed" ? t("Closed") : d.left >= 0 ? <>{t("Seats left")} <strong className="text-slate-800">{d.left}</strong> · {dayPct}%</> : <>{t("Over by")} <strong className="text-red-700">{-d.left}</strong></>}
            {d.waitingGuests ? <> · <span className="text-accent-700">+{d.waitingGuests} {t("in requests")}</span></> : null}
          </p>
        </Tile>

        <Tile icon={<CalendarDays className="size-3.5" />} label={`${t("Bookings")} ${dayWord}`}>
          <p className="text-3xl font-semibold tabular-nums text-slate-900">{d.bookings}</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
            {GUEST_TYPES.map((k) => <div key={k} className={TYPE_BG[k]} style={{ width: `${pct(d.byType[k], d.guests)}%` }} />)}
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted">
            {GUEST_TYPES.filter((k) => d.byType[k]).map((k) => <span key={k}>{typeName(k)} <strong className="text-slate-800">{d.byType[k]}</strong></span>)}
            {d.cancelled || d.noShow ? <span className="text-red-600">{t("Cancelled")} {d.cancelled} · {t("No-show")} {d.noShow}</span> : null}
          </p>
        </Tile>

        {data.isToday ? (
          <Tile icon={<Clock className="size-3.5" />} label={t("Right now")}>
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{d.inHouseNow}<span className="text-base font-normal text-muted"> {t("guests in the restaurant")}</span></p>
            <p className="mt-2 text-sm text-slate-700">
              {t("Still to arrive")} <strong>{d.toComeGuests}</strong> {t("guests")} ({d.toComeBookings} {t("bookings")})
            </p>
            <p className="text-xs text-muted">{d.nextArrival ? <>{t("Next arrival")} <strong className="text-slate-800">{d.nextArrival}</strong></> : t("No more arrivals today")}</p>
          </Tile>
        ) : (
          <Tile icon={<Clock className="size-3.5" />} label={t("Busiest time")}>
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{data.peakSlot && data.peakSlot.inHouse ? data.peakSlot.time : "–"}</p>
            <p className="mt-2 text-sm text-slate-700">{data.peakSlot && data.peakSlot.inHouse ? <><strong>{data.peakSlot.inHouse}</strong> {t("guests in the restaurant at once")}</> : t("No bookings yet")}</p>
            <p className="text-xs text-muted">{t("Still to arrive")} {d.toComeBookings} {t("bookings")}</p>
          </Tile>
        )}

        <Tile icon={<PhoneCall className="size-3.5" />} label={t("Phone / LINE requests waiting")} className={data.pendingCount ? "border-accent-300 bg-accent-50/50" : undefined}>
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("text-3xl font-semibold tabular-nums", data.pendingCount ? "text-accent-700" : "text-slate-900")}>{data.pendingCount}</p>
            <Link href="/requests" className="text-xs font-medium text-brand-600 hover:underline">{t("View all")}</Link>
          </div>
          <p className="mt-2 text-sm text-slate-700">{data.pendingCount ? t("Waiting for the store to book a table") : t("Nothing waiting. All requests are handled")}</p>
          {data.pending[0] ? <p className="text-xs text-muted">{t("Oldest waiting")} {ago([...data.pending].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at)}</p> : null}
        </Tile>
      </div>

      {/* 2. What needs doing + requests to key in */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="min-w-0 lg:col-span-3">
          <SectionTitle title={t("Needs attention")} hint={t("Things to check before and during service")} />
          {data.attention.length === 0 ? (
            <Card className="flex items-center gap-3 p-4 text-sm text-emerald-800"><CheckCircle2 className="size-5 text-emerald-600" />{t("All clear. Nothing needs attention")}</Card>
          ) : (
            <ul className="space-y-2">
              {data.attention.map((a) => {
                const Icon = a.tone === "blue" ? Info : AlertTriangle;
                let detail = a.detail;
                if (a.key === "over" && a.detail) detail = a.detail.split(",").map((x) => fmt(x, { weekday: "short", day: "numeric", month: "short" })).join(", ");
                if (a.key === "reqfull" && a.detail) detail = a.detail.replace(/\d{4}-\d{2}-\d{2}/g, (x) => fmt(x, { weekday: "short", day: "numeric", month: "short" }));
                if (a.key === "requests" && a.detail?.startsWith("since:")) detail = `${t("Oldest waiting")} ${ago(a.detail.slice(6))}`;
                return (
                  <li key={a.key}>
                    <Link href={a.href} className={cn("flex items-start gap-3 rounded-xl border p-3 transition hover:shadow-sm", TONE[a.tone].box)}>
                      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[a.tone].icon)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{t(a.text).replace("{n}", String(a.n))}</span>
                        {detail ? <span className="mt-0.5 block truncate text-xs text-slate-600">{detail}</span> : null}
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="min-w-0 lg:col-span-2">
          <SectionTitle title={t("Requests to key in")} action={<Link href="/requests" className="text-xs font-medium text-brand-600 hover:underline">{t("View all")}</Link>} />
          <Card>
            {data.pending.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">{t("No requests here.")}</p>
            ) : (
              <ul className="divide-y">
                {data.pending.map((p) => {
                  const tag = splitCustomerType(p.notes);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-slate-900">{p.customer_name}</span>
                          <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-600">{p.channel === "line" ? "LINE" : t("Phone")}</span>
                        </span>
                        <span className="text-xs text-muted">
                          {fmt(p.requested_date, { weekday: "short", day: "numeric", month: "short" })} {p.requested_time.slice(0, 5)} · {p.party_size} {t("guests")}
                          {tag.type ? ` · ${CUSTOMER_TYPE_LABELS[tag.type]}` : ""}
                        </span>
                      </span>
                      {canHandle ? <Button asChild size="sm"><Link href={`/reservations/new?request=${p.id}`}>{t("Book table")}</Link></Button> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* 3. The day's service: arrivals and how busy each half hour is */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="min-w-0 lg:col-span-3">
          <SectionTitle
            title={`${t("Arrivals")} ${dayWord}`}
            hint={`${d.bookings} ${t("bookings")} · ${d.guests} ${t("guests")}`}
            action={<Link href={`/reservations?date=${data.date}`} className="text-xs font-medium text-brand-600 hover:underline">{t("View all")}</Link>}
          />
          <Card className="overflow-hidden">
            {data.arrivals.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">{t("No bookings on this day yet.")}</p>
            ) : (
              <div className="divide-y">
                {data.arrivals.map((g) => (
                  <div key={g.time} className="flex gap-3 px-4 py-2.5">
                    <div className="w-14 shrink-0 pt-0.5">
                      <p className="text-base font-semibold tabular-nums text-slate-900">{g.time}</p>
                      <p className="text-[11px] text-muted">{g.guests} {t("guests")}</p>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1.5">
                      {g.rows.map((r) => (
                        <li key={r.id}>
                          <Link href={`/reservations/${r.id}`} className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1 hover:bg-slate-50", r.late && "bg-red-50")}>
                            <span className="font-medium text-slate-900">{r.customer_name}</span>
                            <span className="text-sm tabular-nums text-slate-700">{r.party_size} {t("guests")}</span>
                            <span className={cn("rounded px-1.5 text-[11px] font-medium", TYPE_PILL[r.type])}>{typeName(r.type)}</span>
                            <span className="text-xs text-muted">{r.tables.length ? r.tables.map((x) => x.label).join("+") : <span className="text-amber-700">{t("no table")}</span>} · {t("until")} {r.end}</span>
                            {r.allergies || r.dietary_requirements ? <span className="rounded bg-red-100 px-1.5 text-[11px] font-medium text-red-700">⚠ {r.allergies || r.dietary_requirements}</span> : null}
                            {r.late ? <span className="rounded bg-red-600 px-1.5 text-[11px] font-semibold text-white">{t("Late")}</span> : null}
                            <span className="ml-auto"><StatusBadge status={r.status} /></span>
                            {r.note ? <span className="basis-full truncate text-xs text-slate-600">{r.note}</span> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section className="min-w-0 lg:col-span-2">
          <SectionTitle title={t("Guests in the restaurant by time")} hint={data.peakSlot?.inHouse ? `${t("Busiest")} ${data.peakSlot.time} · ${data.peakSlot.inHouse}/${d.seats} ${t("guests")}` : undefined} />
          <Card className="p-4">
            <div className="relative flex h-44 items-end gap-1">
              {d.seats ? (
                <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-red-400" style={{ bottom: `${(d.seats / maxSlot) * 100}%` }}>
                  <span className="absolute -top-4 right-0 bg-white px-1 text-[10px] text-red-600">{t("Seats")} {d.seats}</span>
                </div>
              ) : null}
              {data.slots.map((s) => {
                const over = d.seats > 0 && s.inHouse > d.seats;
                return (
                  <div key={s.time} className="group relative flex h-full flex-1 flex-col justify-end" title={`${s.time} · ${s.inHouse} ${t("guests")} · +${s.arriving}`}>
                    {s.inHouse ? <span className="mb-0.5 text-center text-[10px] tabular-nums text-slate-600">{s.inHouse}</span> : null}
                    <div className={cn("w-full rounded-t", over ? "bg-red-500" : s.time === data.peakSlot?.time && s.inHouse ? "bg-brand-600" : "bg-brand-300", s.time === data.nowSlot && "ring-2 ring-accent-500")} style={{ height: `${(s.inHouse / maxSlot) * 100}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1">
              {data.slots.map((s, i) => <span key={s.time} className="flex-1 text-center text-[10px] tabular-nums text-muted">{i % 2 === 0 ? s.time.slice(0, 2) : ""}</span>)}
            </div>
            <p className="mt-2 text-[11px] text-muted">{t("Each bar = guests seated in that half hour (from booking time to end of seating).")}{data.nowSlot ? ` ${t("Orange outline = now.")}` : ""}</p>
          </Card>
        </section>
      </div>

      {/* 4. Next 14 days */}
      <section>
        <SectionTitle
          title={t("Next 14 days")}
          hint={`${data.outlookGuests} / ${data.outlookSeats} ${t("guests")} · ${pct(data.outlookGuests, data.outlookSeats)}% ${t("of seats booked")}`}
          action={<Link href={`/availability?date=${data.date}`} className="text-xs font-medium text-brand-600 hover:underline">{t("Table availability")}</Link>}
        />
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
            {data.outlook.map((o) => {
              const p = pct(o.total, o.seats);
              return (
                <Link key={o.date} href={`/availability?date=${o.date}`} className={cn("group rounded-lg p-1 text-center transition hover:bg-slate-50", o.date === data.date && "bg-brand-50 ring-1 ring-brand-300")}>
                  <p className="text-[10px] uppercase text-muted">{fmt(o.date, { weekday: "short" })}</p>
                  <p className="text-sm font-semibold text-slate-900">{fmt(o.date, { day: "numeric" })}</p>
                  <div className="relative mx-auto mt-1 flex h-24 w-full max-w-9 flex-col justify-end overflow-hidden rounded bg-slate-100">
                    {o.status === "closed" ? <span className="absolute inset-0 grid place-items-center text-[10px] text-slate-400">{t("Closed")}</span> : null}
                    {o.waiting ? <div className="w-full bg-accent-200" style={{ height: `${(o.waiting / maxOutlook) * 100}%` }} /> : null}
                    {[...GUEST_TYPES].reverse().map((k) => (o.pax[k] ? <div key={k} className={TYPE_BG[k]} style={{ height: `${(o.pax[k] / maxOutlook) * 100}%` }} /> : null))}
                    {o.seats ? <div className="absolute inset-x-0 border-t-2 border-slate-800/60" style={{ bottom: `${(o.seats / maxOutlook) * 100}%` }} /> : null}
                  </div>
                  <p className="mt-1 text-xs font-semibold tabular-nums text-slate-800">{o.status === "closed" ? "–" : o.total}</p>
                  {o.status !== "closed" ? <span className={cn("mt-0.5 inline-block rounded px-1 text-[10px] font-semibold", STATUS_BADGE[o.status])}>{o.status === "ok" ? `${p}%` : t(STATUS_TEXT[o.status])}</span> : null}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
            {GUEST_TYPES.map((k) => <span key={k} className="flex items-center gap-1"><span className={cn("size-2 rounded-sm", TYPE_BG[k])} />{typeName(k)}</span>)}
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-accent-200" />{t("Requests not keyed in yet")}</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-slate-700" />{t("Seats for the day")}</span>
          </div>
        </Card>
      </section>

      {/* 5. The month so far */}
      <MonthSection m={m} lm={lm} t={t} fmt={fmt} typeName={typeName} weekdays={data.weekdays} maxWeekday={maxWeekday} />

      {/* 6. All restaurants on this day */}
      {data.branches.length > 1 ? (
        <section>
          <SectionTitle title={`${t("All restaurants")} ${dayWord}`} />
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("Restaurant")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Bookings")}</th>
                  <th className="px-4 py-2 font-medium">{t("Guests / seats")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Requests waiting")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.branches.map((b) => {
                  const p = b.seats ? pct(b.guests, b.seats) : 0;
                  return (
                    <tr key={b.id} className={cn(b.id === restaurant.id && "bg-brand-50/50")}>
                      <td className="px-4 py-2"><Link href={`/dashboard?restaurant=${b.id}&date=${data.date}`} className="font-medium text-slate-900 hover:underline">{b.name}</Link></td>
                      <td className="px-4 py-2 text-right tabular-nums">{b.bookings}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-16 tabular-nums">{b.guests}{b.seats ? <span className="text-muted"> / {b.seats}</span> : null}</span>
                          {b.seats ? <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full", p > 100 ? "bg-red-500" : p >= 90 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${Math.min(100, p)}%` }} /></div> : null}
                        </div>
                      </td>
                      <td className={cn("px-4 py-2 text-right tabular-nums", b.pending ? "font-semibold text-accent-700" : "text-muted")}>{b.pending}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

const WEEKDAY_SAMPLE = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"]; // Mon..Sun

function MonthSection({ m, lm, t, fmt, typeName, weekdays, maxWeekday }: {
  m: MonthStats; lm: MonthStats; t: Translate;
  fmt: (x: string, o: Intl.DateTimeFormatOptions) => string;
  typeName: (k: GuestType) => string;
  weekdays: { day: number; avg: number; days: number }[];
  maxWeekday: number;
}) {
  const occ = m.seats ? (m.guests / m.seats) * 100 : 0;
  const lastOcc = lm.seats ? (lm.guests / lm.seats) * 100 : 0;
  const monthName = fmt(`${m.month}-01`, { month: "long", year: "numeric" });
  const lastName = fmt(`${lm.month}-01`, { month: "short" });
  const reqHandled = m.requests.booked + m.requests.declined;
  const stat = (label: string, value: React.ReactNode, sub: React.ReactNode) => (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">{sub}</p>
    </div>
  );
  return (
    <section>
      <SectionTitle title={`${t("This month")} · ${monthName}`} hint={`${t("Whole month, including days already booked ahead. Arrows compare with")} ${lastName}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat(t("Guests booked"), m.guests.toLocaleString(), <>{t("of")} {m.seats.toLocaleString()} {t("seats")} · <strong className="text-slate-700">{occ.toFixed(0)}%</strong> <Delta now={occ} before={lastOcc} unit="%" /></>)}
        {stat(t("Bookings"), m.bookings.toLocaleString(), <>{t("avg.")} {m.avgParty.toFixed(1)} {t("guests per table")} <Delta now={m.bookings} before={lm.bookings} /></>)}
        {stat(t("Cancelled + no-show"), `${(m.lostRate * 100).toFixed(0)}%`, <>{t("Cancelled")} {m.cancelled} · {t("No-show")} {m.noShow} <Delta now={m.lostRate * 100} before={lm.lostRate * 100} invert unit="%" /></>)}
        {stat(t("Phone / LINE requests"), m.requests.total, <>{t("Phone")} {m.requests.call} · LINE {m.requests.line} · {t("declined")} <strong className={m.requests.declined ? "text-red-600" : "text-slate-700"}>{reqHandled ? pct(m.requests.declined, reqHandled) : 0}%</strong></>)}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{t("Guests by type")}</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {GUEST_TYPES.map((k) => <div key={k} className={TYPE_BG[k]} style={{ width: `${pct(m.byType[k], m.guests)}%` }} />)}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {GUEST_TYPES.map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-sm", TYPE_BG[k])} />{typeName(k)}</span>
                <span className="tabular-nums"><strong>{m.byType[k]}</strong> <span className="text-xs text-muted">({pct(m.byType[k], m.guests)}%)</span> <Delta now={m.byType[k]} before={lm.byType[k]} /></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{t("Average guests by day of week")}</p>
          <div className="flex h-32 items-end gap-2">
            {weekdays.map((w, i) => (
              <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="text-[10px] tabular-nums text-slate-600">{w.days ? Math.round(w.avg) : ""}</span>
                <div className={cn("w-full rounded-t", w.avg === maxWeekday && w.avg > 0 ? "bg-brand-600" : "bg-brand-300")} style={{ height: `${(w.avg / maxWeekday) * 85}%` }} />
                <span className="mt-1 text-[10px] text-muted">{fmt(WEEKDAY_SAMPLE[i], { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">{t("Helps plan staff for busy days.")}</p>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{t("Where bookings come from")}</p>
          <ul className="space-y-1.5 text-sm">
            {m.bySource.slice(0, 5).map((s) => (
              <li key={s.name}>
                <div className="flex justify-between"><span>{t(s.name)}</span><span className="tabular-nums font-medium">{s.bookings}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-accent-400" style={{ width: `${pct(s.bookings, m.bookings)}%` }} /></div>
              </li>
            ))}
            {m.bySource.length === 0 ? <li className="text-muted">–</li> : null}
          </ul>
          {m.declineReasons.length ? (
            <div className="mt-3 border-t pt-2">
              <p className="text-xs font-medium text-slate-700">{t("Why requests were declined")}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {m.declineReasons.map((r) => <li key={r.reason} className="flex justify-between gap-2"><span className="truncate">{r.reason}</span><span className="tabular-nums">{r.n}</span></li>)}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted"><UtensilsCrossed className="size-3" />{t("Full / over-cap days this month")}: {m.fullDays} / {m.overDays}</p>
        </Card>
      </div>
    </section>
  );
}

