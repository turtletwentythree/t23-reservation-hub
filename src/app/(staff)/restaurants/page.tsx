import Link from "next/link";
import { getStaffT } from "@/lib/i18n/staff-server";
import { Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { RestaurantForm } from "./restaurant-form";

export const metadata = { title: "Restaurants" };

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.view");
  const showAll = (await searchParams).show === "all";
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("*, tables(count), restaurant_areas(count)").order("name");
  const all = data ?? [];
  const disabledCount = all.filter((r) => !r.is_active).length;
  // Switched-off restaurants are hidden by default; Admins can still open them to switch them back on.
  const list = showAll ? all : all.filter((r) => r.is_active);
  return (
    <div>
      <PageHeader
        title={t("Restaurants")}
        description={t("Branches, booking rules, opening hours and booking links.")}
        actions={
          roleCan(ctx.role, "restaurant.create") ? (
            <Dialog>
              <DialogTrigger asChild><Button><Plus /> Add restaurant</Button></DialogTrigger>
              <DialogContent title="Add restaurant" className="max-w-2xl"><RestaurantForm /></DialogContent>
            </Dialog>
          ) : null
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((r) => (
          <Link key={r.id} href={`/restaurants/${r.id}`}>
            <Card className="h-full p-4 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.name}</p>
                {r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}
              </div>
              <p className="text-sm text-muted">{r.cuisine ?? "—"}</p>
              <p className="mt-3 text-xs text-muted">
                {(r.tables as unknown as { count: number }[])[0]?.count ?? 0} tables · {(r.restaurant_areas as unknown as { count: number }[])[0]?.count ?? 0} areas
              </p>
              <p className="mt-1 text-xs">{r.accepts_online_bookings ? <span className="text-brand-700">Online booking: /book/{r.slug}</span> : <span className="text-muted">Online booking off</span>}</p>
            </Card>
          </Link>
        ))}
      </div>
      {disabledCount > 0 && roleCan(ctx.role, "restaurant.manage") ? (
        <p className="mt-4 text-sm text-muted">
          {showAll ? (
            <Link href="/restaurants" className="text-brand-700 hover:underline">Hide disabled restaurants</Link>
          ) : (
            <Link href="/restaurants?show=all" className="text-brand-700 hover:underline">Show {disabledCount} disabled restaurant{disabledCount === 1 ? "" : "s"}</Link>
          )}
        </p>
      ) : null}
    </div>
  );
}
