"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signInAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
