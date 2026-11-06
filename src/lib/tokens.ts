import "server-only";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function pepper() {
  const p = process.env.TOKEN_PEPPER;
  if (!p || p.length < 8) throw new Error("TOKEN_PEPPER is not configured");
  return p;
}

/** Guest self-service token for a reservation: HMAC so it can be re-derived for emails without storing it. */
export function manageToken(reservationId: string): string {
  return createHmac("sha256", pepper()).update(`manage:${reservationId}`).digest("base64url").slice(0, 32);
}

export function verifyManageToken(reservationId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(manageToken(reservationId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function manageUrl(reference: string, reservationId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/reservation/${encodeURIComponent(reference)}?t=${manageToken(reservationId)}`;
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(pepper() + ":" + value).digest("hex");
}

export function randomSecret(prefix: string, bytes = 24) {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}
