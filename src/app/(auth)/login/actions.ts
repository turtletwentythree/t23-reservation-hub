"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(200),
  next: z.string().optional(),
});

function safeNext(next: string | undefined | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/** Starts Microsoft 365 (Azure AD) sign-in through Supabase Auth. */
export async function signInWithMicrosoftAction(formData: FormData) {
  if (!(await rateLimit("login", 10, 300))) redirect("/login?error=rate_limited");
  const next = safeNext(formData.get("next")?.toString());
  // Use the address the user is actually on, so the return URL always matches this site.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email", redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    console.error("[login] Microsoft sign-in could not start:", error?.message);
    redirect(`/login?error=microsoft_unavailable${error?.message ? `&detail=${encodeURIComponent(error.message.slice(0, 200))}` : ""}`);
  }
  redirect(data.url);
}

export async function signInAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  if (!(await rateLimit("login", 10, 300))) return { error: "Too many attempts. Please wait a few minutes." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "Invalid email or password." };

  redirect(safeNext(parsed.data.next));
}
