import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth return URL (Microsoft 365). Exchanges the code for a session, then lets in
 * only people who already have a staff account; anyone else is signed out again.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const toLogin = (error: string, detail?: string) => {
    const target = new URL(`/login?error=${error}`, url.origin);
    if (detail) target.searchParams.set("detail", detail.slice(0, 200));
    return NextResponse.redirect(target);
  };

  // Supabase sends ?error=…&error_description=… when the provider step fails.
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] provider error:", providerError);
    return toLogin("microsoft_failed", providerError);
  }
  if (!code) {
    console.error("[auth/callback] no code in callback", url.search);
    return toLogin("microsoft_failed", "No authorization code was returned.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback] code exchange failed:", error?.message);
    return toLogin("microsoft_failed", error?.message);
  }

  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).limit(1).maybeSingle();
  const { data: profile } = await supabase.from("users").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!role || !profile?.is_active) {
    await supabase.auth.signOut();
    console.error("[auth/callback] signed in but no staff account for", data.user.email);
    return toLogin("not_staff", data.user.email ?? undefined);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
