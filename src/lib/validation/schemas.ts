import { z } from "zod";

/** Checkbox / boolean from forms: "on" | "true" | true -> true; anything else -> false. */
export const bool = (def = false) =>
  z.preprocess((v) => (v === undefined || v === null ? def : v === true || v === "on" || v === "true" || v === "1"), z.boolean());

const optText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const phoneString = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ()\-]{6,30}$/, "Enter a valid phone number");

export const reservationInputSchema = z.object({
  restaurant_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  customer_name: z.string().trim().min(1, "Name is required").max(120),
  phone: phoneString.optional().or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  language: z.enum(["en", "th", "ja", "fr"]).default("en"),
  reservation_date: dateString,
  reservation_time: timeString,
  party_size: z.coerce.number().int().min(1).max(200),
  duration_minutes: z.coerce.number().int().min(15).max(600).optional(),
  booking_source_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  booking_type_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  table_ids: z.array(z.string().uuid()).max(10).default([]),
  auto_assign: bool(true),
  allow_over_capacity: bool(false),
  special_occasion: optText(120),
  dietary_requirements: optText(500),
  allergies: optText(500),
  guest_notes: optText(1000),
  internal_notes: optText(2000),
  deposit_amount: z.coerce.number().min(0).max(10_000_000).default(0),
  status: z.enum(["pending", "confirmed", "arrived", "seated"]).default("confirmed"),
  is_walk_in: bool(false),
});
export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const reservationUpdateSchema = reservationInputSchema
  .omit({ restaurant_id: true, status: true, is_walk_in: true, auto_assign: true })
  .extend({ id: z.string().uuid(), reassign_tables: bool(false) });

export const publicBookingSchema = z.object({
  restaurant_slug: z.string().regex(/^[a-z0-9-]+$/),
  reservation_date: dateString,
  reservation_time: timeString,
  party_size: z.coerce.number().int().min(1).max(200),
  booking_type_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  customer_name: z.string().trim().min(2).max(120),
  phone: phoneString,
  email: z.string().trim().email().max(200),
  language: z.enum(["en", "th", "ja", "fr"]).default("en"),
  special_occasion: optText(120),
  dietary_requirements: optText(500),
  allergies: optText(500),
  guest_notes: optText(1000),
  accept_policy: z.literal(true, { message: "Please accept the booking policy" }),
  marketing_consent: bool(false),
  // honeypot: real users never fill this
  website: z.string().max(0).optional().or(z.literal("")),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

export const restaurantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, "Lowercase letters, numbers and dashes only"),
  cuisine: optText(120),
  description: optText(1000),
  address: optText(300),
  phone: optText(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  timezone: z.string().trim().min(3).max(60).default("Asia/Bangkok"),
  currency: z.string().trim().length(3).toUpperCase().default("THB"),
  is_active: bool(true),
  accepts_online_bookings: bool(true),
});

export const policySchema = z.object({
  default_duration_minutes: z.coerce.number().int().min(15).max(600),
  buffer_minutes: z.coerce.number().int().min(0).max(240),
  slot_interval_minutes: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Choose 5, 10, 15, 20, 30 or 60"),
  min_party_size: z.coerce.number().int().min(1).max(200),
  max_party_size: z.coerce.number().int().min(1).max(200),
  min_advance_minutes: z.coerce.number().int().min(0).max(60 * 24 * 14),
  max_advance_days: z.coerce.number().int().min(1).max(730),
  max_online_bookings_per_day: z.coerce.number().int().min(1).max(10_000).optional().or(z.literal("").transform(() => undefined)),
  max_online_covers_per_day: z.coerce.number().int().min(1).max(100_000).optional().or(z.literal("").transform(() => undefined)),
  cancellation_cutoff_hours: z.coerce.number().int().min(0).max(720),
  modification_cutoff_hours: z.coerce.number().int().min(0).max(720),
  auto_confirm_online: bool(false),
  large_party_threshold: z.coerce.number().int().min(1).max(200).optional().or(z.literal("").transform(() => undefined)),
  deposit_type: z.enum(["none", "per_person", "flat", "full_prepayment"]),
  deposit_amount: z.coerce.number().min(0).max(1_000_000),
  deposit_min_party_size: z.coerce.number().int().min(1).max(200),
  no_show_fee_amount: z.coerce.number().min(0).max(1_000_000),
  duration_rules: z
    .array(z.object({ max_party: z.coerce.number().int().min(1).max(200), minutes: z.coerce.number().int().min(15).max(600) }))
    .max(10)
    .default([]),
  cancellation_policy_en: optText(2000),
  cancellation_policy_th: optText(2000),
  cancellation_policy_ja: optText(2000),
  cancellation_policy_fr: optText(2000),
}).refine((v) => v.max_party_size >= v.min_party_size, { message: "Max party size must be ≥ min", path: ["max_party_size"] });

export const tableSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid(),
  area_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  label: z.string().trim().min(1).max(20),
  min_capacity: z.coerce.number().int().min(1).max(100),
  max_capacity: z.coerce.number().int().min(1).max(100),
  shape: z.enum(["rect", "round", "square", "bar"]).default("rect"),
  is_combinable: bool(true),
  is_online_bookable: bool(true),
  is_active: bool(true),
}).refine((v) => v.max_capacity >= v.min_capacity, { message: "Max capacity must be ≥ min", path: ["max_capacity"] });

export const customerSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: phoneString.optional().or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  preferred_language: z.enum(["en", "th", "ja", "fr"]).default("en"),
  birthday: dateString.optional().or(z.literal("").transform(() => undefined)),
  is_vip: bool(false),
  vip_note: optText(300),
  allergies: optText(500),
  dietary_preferences: optText(500),
  special_requests: optText(1000),
  internal_notes: optText(2000),
  line_user_id: optText(100),
});

export const waitlistSchema = z.object({
  restaurant_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(120),
  phone: phoneString.optional().or(z.literal("").transform(() => undefined)),
  party_size: z.coerce.number().int().min(1).max(100),
  quoted_wait_minutes: z.coerce.number().int().min(0).max(600).optional().or(z.literal("").transform(() => undefined)),
  notes: optText(500),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["super_admin", "host", "viewer"]),
  restaurant_ids: z.array(z.string().uuid()).default([]),
  // Optional: staff who sign in with Microsoft 365 do not need a password.
  password: z.string().min(10, "At least 10 characters").max(200).optional().or(z.literal("").transform(() => undefined)),
});

export const updateUserAccessSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["super_admin", "host", "viewer"]),
  restaurant_ids: z.array(z.string().uuid()).default([]),
  is_active: bool(),
});
