import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RestaurantForm } from "../restaurant-form";
import { PolicyForm } from "./policy-form";
import { HoursEditor } from "./hours-editor";
import { BookingTypes } from "./booking-types";

export default async function RestaurantDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("reservation.view");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: r }, { data: policy }, { data: hours }, { data: types }] = await Promise.all([
    supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
    supabase.from("booking_policies").select("*").eq("restaurant_id", id).maybeSingle(),
    supabase.from("operating_hours").select("*").eq("restaurant_id", id),
    supabase.from("booking_types").select("*").eq("restaurant_id", id).order("sort_order"),
  ]);
  if (!r) notFound();
  const canManage = roleCan(ctx.role, "restaurant.manage");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const embed = `<iframe src="${base}/book/${r.slug}?embed=1" style="width:100%;min-height:760px;border:0" title="Book a table at ${r.name}"></iframe>`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/restaurants" className="inline-flex items-center gap-1 text-sm text-muted hover:text-slate-800"><ArrowLeft className="size-4" /> Restaurants</Link>
      <PageHeader
        title={r.name}
        description={r.is_active ? "Active branch" : "Disabled branch"}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/floor-plan?restaurant=${r.id}&edit=1`}>Tables & floor plan</Link></Button>
            <Button asChild variant="outline"><a href={`/book/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Booking page</a></Button>
          </>
        }
      />
      <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent><RestaurantForm restaurant={r} readOnly={!canManage} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Booking rules</CardTitle></CardHeader><CardContent><PolicyForm restaurantId={r.id} policy={policy} readOnly={!canManage} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Opening hours</CardTitle></CardHeader><CardContent><HoursEditor restaurantId={r.id} initial={hours ?? []} readOnly={!canManage} /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Booking types & dining courses</CardTitle></CardHeader>
        <CardContent>
          <BookingTypes restaurantId={r.id} currency={r.currency} readOnly={!canManage} types={(types ?? []).map((t) => ({ ...t, name: t.name as Record<string, string>, price: t.price === null ? null : Number(t.price), deposit_override: t.deposit_override === null ? null : Number(t.deposit_override) }))} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Booking links & embed widget</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Direct link (use for Google Business Profile, Instagram, LINE OA): <code className="rounded bg-slate-100 px-1">{base}/book/{r.slug}</code></p>
          <p>Language-specific: <code className="rounded bg-slate-100 px-1">?lang=th</code> · <code className="rounded bg-slate-100 px-1">?lang=fr</code></p>
          <p>Embed on a website:</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{embed}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
