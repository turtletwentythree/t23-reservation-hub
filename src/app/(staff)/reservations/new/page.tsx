import { requireStaff } from "@/lib/auth/session";
import { getStaffT } from "@/lib/i18n/staff-server";
import { getReservationFormData } from "@/lib/data/reservation-form-data";
import { pickParam, todayIn, DEFAULT_TZ } from "@/lib/data/common";
import { formatInTimeZone } from "date-fns-tz";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ReservationForm } from "../reservation-form";
import { createClient } from "@/lib/supabase/server";
import { splitCustomerType, withCustomerType } from "@/lib/domain/request-tags";

export const metadata = { title: "New reservation" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getStaffT();
  const ctx = await requireStaff("reservation.write", "reservations");
  const sp = await searchParams;
  const supabase = await createClient();
  // Keying in a Call Center request (phone / LINE): prefill from the request.
  const requestId = pickParam(sp.request);
  const { data: request } = requestId && /^[0-9a-f-]{36}$/i.test(requestId)
    ? await supabase.from("booking_requests").select("*").eq("id", requestId).maybeSingle()
    : { data: null };
  const requestBranch = request && ctx.restaurants.some((r) => r.id === request.restaurant_id) ? request.restaurant_id : null;
  const data = await getReservationFormData(requestBranch && !ctx.branchIds.includes(requestBranch) ? { ...ctx, branchIds: [requestBranch] } : ctx);
  if (data.restaurants.length === 0) return <EmptyState title={t("No active restaurant selected")} description={t("Choose a branch you can book for.")} />;
  const walkIn = pickParam(sp.walkin) === "1";
  const customerId = pickParam(sp.customer);
  const { data: customer } = customerId
    ? await supabase.from("customers").select("id, full_name, phone, email, allergies, dietary_preferences, preferred_language").eq("id", customerId).maybeSingle()
    : { data: null };
  const sourceCode = walkIn ? "walk_in" : request?.channel === "line" ? "line" : "phone";
  const phoneSource = data.sources.find((s) => s.code === sourceCode);
  const requestTag = splitCustomerType(request?.notes);
  const requestNote = request
    ? withCustomerType(
        requestTag.type ?? "internal",
        [`${request.channel === "line" ? "LINE" : "Phone"} request`, request.line_id ? `LINE ID: ${request.line_id}` : null].filter(Boolean).join(" · "),
      )
    : "";
  const [hh, mm] = formatInTimeZone(new Date(), DEFAULT_TZ, "HH:mm").split(":").map(Number);
  const roundedNow = `${String(hh).padStart(2, "0")}:${String(Math.floor(mm / 5) * 5).padStart(2, "0")}`;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={walkIn ? t("Seat a walk-in") : t("New reservation")} description={t("Availability updates as you change date and party size.")} />
      {request ? (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${request.status === "pending" ? "border-accent-200 bg-accent-50 text-accent-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {request.status === "pending"
            ? `${t("Keying in a request from")} ${request.channel === "line" ? "LINE" : t("Call")}: ${request.customer_name} · ${request.party_size} ${t("guests")} · ${request.requested_date} ${request.requested_time.slice(0, 5)}. ${t("Saving marks the request as keyed in.")}`
            : t("This request was already handled. Saving creates a new reservation without changing it.")}
        </div>
      ) : null}
      <Card className="p-4 sm:p-6">
        <ReservationForm
          {...data}
          requestId={request?.status === "pending" ? request.id : undefined}
          simple={Boolean(request)}
          initial={{
            restaurant_id: requestBranch ?? (pickParam(sp.restaurant) && data.restaurants.some((r) => r.id === pickParam(sp.restaurant)) ? pickParam(sp.restaurant)! : data.restaurants[0].id),
            customer_id: customer?.id,
            customer_name: customer?.full_name ?? request?.customer_name ?? (walkIn ? "Walk-in guest" : ""),
            phone: customer?.phone ?? request?.phone ?? "",
            email: customer?.email ?? "",
            language: (customer?.preferred_language as "en") ?? (request ? "th" : "en"),
            reservation_date: request?.requested_date ?? pickParam(sp.date) ?? todayIn(),
            reservation_time: walkIn ? roundedNow : (request?.requested_time.slice(0, 5) ?? pickParam(sp.time) ?? ""),
            party_size: request?.party_size ?? Number(pickParam(sp.party) ?? 2),
            booking_source_id: phoneSource?.id ?? "",
            booking_type_id: "",
            table_ids: pickParam(sp.table) ? [pickParam(sp.table)!] : [],
            special_occasion: "",
            dietary_requirements: customer?.dietary_preferences ?? "",
            allergies: customer?.allergies ?? "",
            guest_notes: request ? requestTag.notes : "",
            internal_notes: requestNote,
            deposit_amount: 0,
            status: walkIn ? "seated" : "confirmed",
            is_walk_in: walkIn,
          }}
        />
      </Card>
    </div>
  );
}
