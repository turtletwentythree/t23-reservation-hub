import { describe, expect, it } from "vitest";
import { publicBookingSchema } from "@/lib/validation/schemas";

const base = {
  restaurant_slug: "kappo-takashi",
  reservation_date: "2026-12-10",
  reservation_time: "18:00",
  party_size: 2,
  customer_name: "Test Guest",
  phone: "0812345678",
  email: "guest@example.com",
  accept_policy: true,
  accept_privacy_notice: true,
};

describe("public booking consents (PDPA)", () => {
  it("books without marketing consent, which defaults to off", () => {
    const r = publicBookingSchema.parse(base);
    expect(r.marketing_consent).toBe(false);
    expect(r.marketing_channels).toEqual([]);
    expect(r.health_data_consent).toBe(false);
  });
  it("requires the privacy notice acknowledgement separately from the booking terms", () => {
    expect(publicBookingSchema.safeParse({ ...base, accept_privacy_notice: false }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, accept_privacy_notice: undefined }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, accept_policy: false }).success).toBe(false);
  });
  it("only accepts known marketing channels", () => {
    expect(publicBookingSchema.parse({ ...base, marketing_consent: true, marketing_channels: ["email", "line"] }).marketing_channels).toEqual(["email", "line"]);
    expect(publicBookingSchema.safeParse({ ...base, marketing_channels: ["fax"] }).success).toBe(false);
  });
});
