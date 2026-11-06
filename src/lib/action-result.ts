import { ZodError } from "zod";
import { AuthorizationError } from "@/lib/auth/permissions";
import { DomainError } from "@/lib/domain/reservation-service";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Converts known errors to user-facing messages; logs and hides unexpected ones. */
export function fail(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    const first = err.issues[0];
    return { ok: false, error: first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Invalid input", fieldErrors };
  }
  if (err instanceof AuthorizationError || err instanceof DomainError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}
