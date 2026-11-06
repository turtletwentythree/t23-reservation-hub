"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createRestaurantAction, updateRestaurantAction } from "./actions";

type R = { id?: string; name: string; slug: string; cuisine: string | null; description: string | null; address: string | null; phone: string | null; email: string | null; timezone: string; currency: string; is_active: boolean; accepts_online_bookings: boolean };

export function RestaurantForm({ restaurant, readOnly }: { restaurant?: R; readOnly?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) =>
        start(async () => {
          const data = Object.fromEntries(fd);
          const res = restaurant?.id ? await updateRestaurantAction(restaurant.id, data) : await createRestaurantAction(data);
          if (!res.ok) return void toast.error(res.error);
          toast.success(restaurant?.id ? "Restaurant saved" : "Restaurant created");
          if (!restaurant?.id) router.push(`/restaurants/${res.data.id}`);
          router.refresh();
        })
      }
    >
      <fieldset disabled={readOnly || pending} className="contents">
        <Field label="Name"><Input name="name" defaultValue={restaurant?.name} required /></Field>
        <Field label="URL slug" hint="Booking page: /book/slug"><Input name="slug" defaultValue={restaurant?.slug} required pattern="[a-z0-9-]{2,60}" /></Field>
        <Field label="Cuisine"><Input name="cuisine" defaultValue={restaurant?.cuisine ?? ""} /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={restaurant?.phone ?? ""} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={restaurant?.email ?? ""} /></Field>
        <Field label="Address"><Input name="address" defaultValue={restaurant?.address ?? ""} /></Field>
        <Field label="Time zone"><Input name="timezone" defaultValue={restaurant?.timezone ?? "Asia/Bangkok"} required /></Field>
        <Field label="Currency"><Input name="currency" defaultValue={restaurant?.currency ?? "THB"} maxLength={3} required /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={restaurant?.description ?? ""} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={restaurant?.is_active ?? true} /> Active (uncheck to disable the branch)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accepts_online_bookings" defaultChecked={restaurant?.accepts_online_bookings ?? true} /> Accept online bookings</label>
        {!readOnly ? <div className="sm:col-span-2"><Button type="submit">{pending ? "Saving…" : restaurant?.id ? "Save" : "Create restaurant"}</Button></div> : null}
      </fieldset>
    </form>
  );
}
