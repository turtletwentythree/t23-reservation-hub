"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signInAction, signInWithMicrosoftAction } from "./actions";

const ERRORS: Record<string, string> = {
  not_staff: "This Microsoft account does not have access. Ask an Admin to add your email in Users.",
  microsoft_failed: "Microsoft sign-in did not complete. Please try again.",
  microsoft_unavailable: "Microsoft sign-in is not set up yet. Please use email and password.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
};

export function LoginForm({ next, error, detail }: { next?: string; error?: string; detail?: string }) {
  const [state, action, pending] = useActionState(signInAction, undefined);
  const message = state?.error ?? (error ? `${ERRORS[error] ?? "Sign-in failed."}${detail ? ` (${detail})` : ""}` : undefined);
  return (
    <div className="space-y-4">
      <form action={signInWithMicrosoftAction}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Button type="submit" variant="outline" className="w-full gap-2">
          <svg viewBox="0 0 21 21" aria-hidden="true" className="size-4"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
          Sign in with Microsoft 365
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
