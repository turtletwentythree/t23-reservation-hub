"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";
import { createUserAction, updateUserAction } from "./actions";

type U = { id: string; email: string; full_name: string | null; is_active: boolean; role: AppRole; restaurant_ids: string[] };

export function UserForm({ user, restaurants }: { user?: U; restaurants: { id: string; name: string }[] }) {
  const [role, setRole] = useState<AppRole>(user?.role ?? "host");
  const [branches, setBranches] = useState<string[]>(user?.restaurant_ids ?? []);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          const base = { full_name: fd.get("full_name"), role, restaurant_ids: branches };
          const res = user
            ? await updateUserAction({ ...base, user_id: user.id, is_active: fd.get("is_active") === "on" })
            : await createUserAction({ ...base, email: fd.get("email"), password: fd.get("password") });
          if (res.ok) { toast.success(user ? "User updated" : "User created"); router.refresh(); } else toast.error(res.error);
        })
      }
    >
      {!user ? <Field label="Email"><Input name="email" type="email" required /></Field> : <p className="text-sm text-muted">{user.email}</p>}
      <Field label="Full name"><Input name="full_name" defaultValue={user?.full_name ?? ""} required /></Field>
      {!user ? <Field label="Temporary password" hint="Share securely; the user should change it after first sign-in."><Input name="password" type="text" minLength={10} required /></Field> : null}
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </Field>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-700">Branch access {role === "super_admin" ? "(Super Admins see all branches)" : ""}</p>
        <div className="grid grid-cols-2 gap-1">
          {restaurants.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={role === "super_admin"} checked={role === "super_admin" || branches.includes(r.id)} onChange={(e) => setBranches(e.target.checked ? [...branches, r.id] : branches.filter((b) => b !== r.id))} />
              {r.name}
            </label>
          ))}
        </div>
      </div>
      {user ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={user.is_active} /> Account active</label> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : user ? "Save" : "Create user"}</Button>
    </form>
  );
}
