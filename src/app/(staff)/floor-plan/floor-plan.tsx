"use client";
import { useT } from "@/components/staff-locale";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Save, Combine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";
import { assignTablesAction, setStatusAction } from "../reservations/actions";
import { createAreaAction, deleteAreaAction, renameAreaAction, deleteCombinationAction, deleteTableAction, saveCombinationAction, saveLayoutAction, saveTableAction, setTableStatusAction } from "./actions";

export type FPTable = {
  id: string; label: string; area_id: string | null; min_capacity: number; max_capacity: number; shape: "rect" | "round" | "square" | "bar";
  pos_x: number; pos_y: number; width: number; height: number; rotation: number; service_status: "available" | "cleaning" | "out_of_service";
  is_combinable: boolean; is_online_bookable: boolean; is_active: boolean;
};
export type FPReservation = { id: string; reference: string; customer_name: string; party_size: number; time: string; status: ReservationStatus; starts: number; ends: number; table_ids: string[]; allergies: string | null; is_vip: boolean };
type LiveStatus = "available" | "reserved" | "arrived" | "seated" | "cleaning" | "out_of_service";

const LIVE: Record<LiveStatus, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-white border-brand-300 text-brand-800" },
  reserved: { label: "Reserved", cls: "bg-amber-50 border-amber-400 text-amber-900" },
  arrived: { label: "Arrived", cls: "bg-sky-100 border-sky-500 text-sky-900" },
  seated: { label: "Seated", cls: "bg-purple-100 border-purple-500 text-purple-900" },
  cleaning: { label: "Cleaning", cls: "bg-slate-100 border-slate-400 text-slate-600 border-dashed" },
  out_of_service: { label: "Out of service", cls: "bg-red-50 border-red-300 text-red-700 opacity-60" },
};

export function FloorPlan({ restaurantId, areas, tables: initialTables, combinations, reservations, at, canLayout, canOperate, editMode, date }: {
  restaurantId: string;
  areas: { id: string; name: string; canvas_width: number; canvas_height: number }[];
  tables: FPTable[];
  combinations: { id: string; name: string; min_capacity: number; max_capacity: number; table_ids: string[] }[];
  reservations: FPReservation[];
  at: number;
  canLayout: boolean;
  canOperate: boolean;
  editMode: boolean;
  date: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [tables, setTables] = useState(initialTables);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [editTable, setEditTable] = useState<Partial<FPTable> | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const area = areas.find((a) => a.id === areaId);

  const statusOf = (t: FPTable): { s: LiveStatus; r?: FPReservation } => {
    if (t.service_status === "out_of_service") return { s: "out_of_service" };
    const mine = reservations.filter((r) => r.table_ids.includes(t.id));
    const seated = mine.find((r) => r.status === "seated");
    if (seated) return { s: "seated", r: seated };
    const arrived = mine.find((r) => r.status === "arrived");
    if (arrived) return { s: "arrived", r: arrived };
    if (t.service_status === "cleaning") return { s: "cleaning" };
    const upcoming = mine.find((r) => (r.status === "confirmed" || r.status === "pending") && r.starts - 30 * 60_000 <= at && r.ends > at);
    if (upcoming) return { s: "reserved", r: upcoming };
    return { s: "available" };
  };

  const visible = tables.filter((t) => t.area_id === areaId || (!t.area_id && areaId === areas[0]?.id));
  const sel = tables.find((t) => t.id === selected);
  const selReservations = useMemo(() => (sel ? reservations.filter((r) => r.table_ids.includes(sel.id)).sort((a, b) => a.starts - b.starts) : []), [sel, reservations]);
  const unassigned = reservations.filter((r) => r.table_ids.length === 0 && ["pending", "confirmed", "arrived"].includes(r.status));
  const counts = visible.reduce<Record<string, number>>((acc, t) => ((acc[statusOf(t).s] = (acc[statusOf(t).s] ?? 0) + 1), acc), {});

  const onPointerDown = (e: React.PointerEvent, t: FPTable) => {
    if (!editMode) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    drag.current = { id: t.id, dx: e.clientX - rect.left - t.pos_x, dy: e.clientY - rect.top - t.pos_y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !area) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const grid = 10;
    const { id, dx, dy } = drag.current;
    setTables((ts) =>
      ts.map((t) =>
        t.id === id
          ? { ...t, pos_x: Math.max(0, Math.min(area.canvas_width - t.width, Math.round((e.clientX - rect.left - dx) / grid) * grid)), pos_y: Math.max(0, Math.min(area.canvas_height - t.height, Math.round((e.clientY - rect.top - dy) / grid) * grid)) }
          : t,
      ),
    );
    setDirty(true);
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(msg); router.refresh(); } else toast.error(res.error ?? t("Failed"));
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {areas.map((a) => (
            <button key={a.id} onClick={() => setAreaId(a.id)} className={cn("rounded-full border px-3 py-1 text-sm", a.id === areaId ? "border-brand-500 bg-brand-500 text-white" : "bg-white")}>
              {a.name}
            </button>
          ))}
          {editMode && canLayout ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { const n = window.prompt(t("New zone name (e.g. Main Dining, Terrace, Private room)")); if (n) run(() => createAreaAction(restaurantId, n), t("Zone added")); }}><Plus />{" "}{t("Zone")}</Button>
              {area ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => { const n = window.prompt(t("Rename zone"), area.name); if (n && n !== area.name) run(() => renameAreaAction(restaurantId, area.id, n), t("Zone renamed")); }}>{t("Rename zone")}</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (window.confirm(`Delete zone "${area.name}"? It must have no tables.`)) run(() => deleteAreaAction(restaurantId, area.id), t("Zone deleted")); }}>{t("Delete zone")}</Button>
                </>
              ) : null}
            </>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-1 text-xs">
            {(Object.keys(LIVE) as LiveStatus[]).map((s) => <span key={s} className={cn("rounded border px-1.5 py-0.5", LIVE[s].cls)}>{t(LIVE[s].label)} {counts[s] ?? 0}</span>)}
          </div>
        </div>
        {editMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 p-2 text-sm">
            <span className="font-medium text-accent-700">{t("Layout editor")}</span>
            <span className="text-xs text-accent-700">{t("Drag tables to move. Shift-click to select tables to combine.")}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditTable({ shape: "rect", min_capacity: 1, max_capacity: 4, area_id: areaId, is_combinable: true, is_online_bookable: true, is_active: true })}><Plus />{" "}{t("Table")}</Button>
              <Button size="sm" variant="outline" disabled={multi.length < 2} onClick={() => {
                const ts = tables.filter((t) => multi.includes(t.id));
                const name = window.prompt(t("Combination name"), ts.map((t) => t.label).join("+"));
                if (!name) return;
                const max = ts.reduce((a, t) => a + t.max_capacity, 0);
                run(() => saveCombinationAction(restaurantId, { name, table_ids: multi, min_capacity: Math.max(...ts.map((t) => t.max_capacity)) + 1, max_capacity: max }), t("Tables combined"));
                setMulti([]);
              }}><Combine /> {t("Combine")} ({multi.length})</Button>
              <Button size="sm" disabled={!dirty || pending} onClick={() => run(async () => { const r = await saveLayoutAction(restaurantId, visible.map(({ id, pos_x, pos_y, width, height, rotation }) => ({ id, pos_x, pos_y, width, height, rotation }))); if (r.ok) setDirty(false); return r; }, "Layout saved")}><Save />{" "}{t("Save layout")}</Button>
            </div>
          </div>
        ) : null}
        <div className="overflow-auto rounded-xl border bg-[radial-gradient(circle,#dfe5e0_1px,transparent_1px)] [background-size:20px_20px]">
          <div ref={canvasRef} className="relative touch-none select-none" style={{ width: area?.canvas_width ?? 1000, height: area?.canvas_height ?? 700 }} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
            {visible.map((t) => {
              const { s, r } = statusOf(t);
              return (
                <button
                  key={t.id}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onClick={(e) => (editMode && e.shiftKey ? setMulti((m) => (m.includes(t.id) ? m.filter((x) => x !== t.id) : [...m, t.id])) : setSelected(t.id))}
                  onDoubleClick={() => editMode && setEditTable(t)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 text-center shadow-sm transition-shadow",
                    LIVE[s].cls,
                    t.shape === "round" ? "rounded-full" : "rounded-lg",
                    selected === t.id && "ring-2 ring-accent-500 ring-offset-2",
                    multi.includes(t.id) && "ring-2 ring-sky-500",
                    !t.is_active && "opacity-40",
                    editMode ? "cursor-move" : "cursor-pointer",
                  )}
                  style={{ left: t.pos_x, top: t.pos_y, width: t.width, height: t.height, transform: `rotate(${t.rotation}deg)` }}
                >
                  <span className="text-sm font-bold leading-none">{t.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{t.min_capacity}-{t.max_capacity}</span>
                  {r ? <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{r.time} {r.customer_name.split(" ")[0]} ({r.party_size})</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        {combinations.length ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted">{t("Combinations:")}</span>
            {combinations.map((c) => (
              <Badge key={c.id} tone="blue">
                {c.name} ({c.min_capacity}-{c.max_capacity})
                {editMode ? <button onClick={() => run(() => deleteCombinationAction(restaurantId, c.id), t("Combination removed (tables separated)"))} aria-label={t("Separate")}><Trash2 className="size-3" /></button> : null}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {sel ? (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t("Table")} {sel.label} <span className="text-sm font-normal text-muted">· {sel.min_capacity}-{sel.max_capacity} seats</span></p>
              <Badge>{t(LIVE[statusOf(sel).s].label)}</Badge>
            </div>
            {canOperate ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {(["available", "cleaning", "out_of_service"] as const).map((s) => (
                  <Button key={s} size="sm" variant={sel.service_status === s ? "default" : "outline"} disabled={pending} onClick={() => run(() => setTableStatusAction(sel.id, s), `Table ${t(LIVE[s].label).toLowerCase()}`)}>
                    {t(LIVE[s].label)}
                  </Button>
                ))}
                <Button size="sm" variant="accent" asChild><Link href={`/reservations/new?restaurant=${restaurantId}&table=${sel.id}&walkin=1`}>{t("Seat walk-in")}</Link></Button>
              </div>
            ) : null}
            {editMode ? <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEditTable(sel)}>{t("Edit table")}</Button> : null}
            <p className="mt-3 text-xs font-medium uppercase text-muted">{t("Bookings")} {date}</p>
            <ul className="mt-1 space-y-1.5">
              {selReservations.length === 0 ? <li className="text-sm text-muted">{t("No bookings.")}</li> : null}
              {selReservations.map((r) => (
                <li key={r.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <Link href={`/reservations/${r.id}`} className="font-medium hover:text-brand-700">{r.time} · {r.is_vip ? "★ " : ""}{r.customer_name} ({r.party_size})</Link>
                    <Badge tone={STATUS_META[r.status].tone}>{t(STATUS_META[r.status].label)}</Badge>
                  </div>
                  {r.allergies ? <p className="text-xs text-amber-700">⚠ {r.allergies}</p> : null}
                  {canOperate ? (
                    <div className="mt-1 flex gap-1">
                      {(r.status === "confirmed" || r.status === "pending") ? <Button size="sm" variant="outline" onClick={() => run(() => setStatusAction(r.id, "arrived"), t("Checked in"))}>{t("Arrived")}</Button> : null}
                      {(r.status === "confirmed" || r.status === "pending" || r.status === "arrived") ? <Button size="sm" onClick={() => run(() => setStatusAction(r.id, "seated"), t("Seated"))}>{t("Seat")}</Button> : null}
                      {r.status === "seated" ? <Button size="sm" onClick={() => run(async () => { const res = await setStatusAction(r.id, "completed"); if (res.ok) await setTableStatusAction(sel.id, "cleaning"); return res; }, "Completed — table set to cleaning")}>{t("Complete")}</Button> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canOperate && unassigned.length ? (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase text-muted">{t("Assign an unassigned booking")}</p>
                <Select className="mt-1" defaultValue="" onChange={(e) => { const id = e.target.value; if (id) run(() => assignTablesAction(id, [sel.id]), `Assigned to ${sel.label}`); }}>
                  <option value="">{t("Choose…")}</option>
                  {unassigned.map((r) => <option key={r.id} value={r.id}>{r.time} {r.customer_name} ({r.party_size})</option>)}
                </Select>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="p-4 text-sm text-muted">{t("Select a table to see bookings and actions.")}</Card>
        )}
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">{t("Unassigned")} ({unassigned.length})</p>
          <ul className="space-y-1 text-sm">
            {unassigned.slice(0, 15).map((r) => <li key={r.id}><Link className="hover:text-brand-700" href={`/reservations/${r.id}`}>{r.time} · {r.customer_name} ({r.party_size})</Link></li>)}
            {unassigned.length === 0 ? <li className="text-muted">{t("All bookings have tables.")}</li> : null}
          </ul>
        </Card>
      </div>

      <Dialog open={editTable !== null} onOpenChange={(o) => !o && setEditTable(null)}>
        {editTable ? (
          <DialogContent title={editTable.id ? `Edit table ${editTable.label}` : t("New table")}>
            <form
              className="grid grid-cols-2 gap-3"
              action={(fd) =>
                run(async () => {
                  const res = await saveTableAction({ ...Object.fromEntries(fd), id: editTable.id, restaurant_id: restaurantId });
                  if (res.ok) setEditTable(null);
                  return res;
                }, "Table saved")
              }
            >
              <Field label={t("Label")}><Input name="label" defaultValue={editTable.label} required /></Field>
              <Field label={t("Shape")}>
                <Select name="shape" defaultValue={editTable.shape}>
                  <option value="rect">{t("Rectangle")}</option><option value="square">{t("Square")}</option><option value="round">{t("Round")}</option><option value="bar">{t("Counter / bar")}</option>
                </Select>
              </Field>
              <Field label={t("Min seats")}><Input type="number" name="min_capacity" defaultValue={editTable.min_capacity} min={1} /></Field>
              <Field label={t("Max seats")}><Input type="number" name="max_capacity" defaultValue={editTable.max_capacity} min={1} /></Field>
              <Field label={t("Area")} className="col-span-2">
                <Select name="area_id" defaultValue={editTable.area_id ?? ""}>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_combinable" defaultChecked={editTable.is_combinable} />{" "}{t("Combinable")}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_online_bookable" defaultChecked={editTable.is_online_bookable} />{" "}{t("Online bookable")}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={editTable.is_active} />{" "}{t("Active")}</label>
              <div className="col-span-2 flex justify-between">
                {editTable.id ? <Button type="button" variant="ghost" className="text-red-700" onClick={() => run(async () => { const r = await deleteTableAction(editTable.id!, restaurantId); if (r.ok) setEditTable(null); return r; }, "Table deleted")}>{t("Delete")}</Button> : <span />}
                <Button type="submit" disabled={pending}>{t("Save table")}</Button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
