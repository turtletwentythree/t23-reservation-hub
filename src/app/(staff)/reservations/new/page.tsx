import { requireStaff } from "@/lib/auth/session";
import { getReservationFormData } from "@/lib/data/reservation-form-data";
import { pickParam, todayIn, DEFAULT_TZ } from "@/lib/data/common";
import { formatInTimeZone } from "date-fns-tz";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ReservationForm } from "../reservation-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New reservation" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff("reservation.write");
  const sp = await searchParams;
  const data = await getReservationFormData(ctx);
  if (data.restaurants.length === 0) return <EmptyState title="No active restaurant selected" description="Choose a branch you can book for." />;
  const walkIn = pickParam(sp.walkin) === "1";
  const customerId = pickParam(sp.customer);
  const { data: customer } = customerId
    ? await (await createClient()).from("customers").select("id, full_name, phone, email, allergies, dietary_preferences, preferred_language").eq("id", customerId).maybeSingle()
    : { data: null };
  const phoneSource = data.sources.find((s) => s.code === (walkIn ? "walk_in" : "phone"));
  const [hh, mm] = formatInTimeZone(new Date(), DEFAULT_TZ, "HH:mm").split(":").map(Number);
  const roundedNow = `${String(hh).padStart(2, "0")}:${String(Math.floor(mm / 5) * 5).padStart(2, "0")}`;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={walkIn ? "Seat a walk-in" : "New reservation"} description="Availability updates as you change date and party size." />
      <Card className="p-4 sm:p-6">
        <ReservationForm
          {...data}
          initial={{
            restaurant_id: pickParam(sp.restaurant) && data.restaurants.some((r) => r.id === pickParam(sp.restaurant)) ? pickParam(sp.restaurant)! : data.restaurants[0].id,
            customer_id: customer?.id,
            customer_name: customer?.full_name ?? (walkIn ? "Walk-in guest" : ""),
            phone: customer?.phone ?? "",
            email: customer?.email ?? "",
            language: (customer?.preferred_language as "en") ?? "en",
            reservation_date: pickParam(sp.date) ?? todayIn(),
            reservation_time: walkIn ? roundedNow : (pickParam(sp.time) ?? ""),
            party_size: Number(pickParam(sp.party) ?? 2),
            booking_source_id: phoneSource?.id ?? "",
            booking_type_id: "",
            table_ids: pickParam(sp.table) ? [pickParam(sp.table)!] : [],
            special_occasion: "",
            dietary_requirements: customer?.dietary_preferences ?? "",
            allergies: customer?.allergies ?? "",
            guest_notes: "",
            internal_notes: "",
            deposit_amount: 0,
            status: walkIn ? "seated" : "confirmed",
            is_walk_in: walkIn,
          }}
        />
      </Card>
    </div>
  );
}
