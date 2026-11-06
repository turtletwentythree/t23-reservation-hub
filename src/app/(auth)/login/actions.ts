"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(200),
  next: z.string().optional(),
});

export async function signInAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  if (!(await rateLimit("login", 10, 300))) return { error: "Too many attempts. Please wait a few minutes." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "Invalid email or password." };

  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}
