"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/staff-locale";
import { NAV_ITEMS, type ConfigurableRole, type PageKey } from "@/components/layout/nav";
import { savePageAccessAction } from "./actions";

const ROLES: { role: ConfigurableRole; label: string }[] = [
  { role: "host", label: "Store" },
  { role: "viewer", label: "View" },
];

export function PageAccessMatrix({ possible, current }: {
  possible: Record<ConfigurableRole, PageKey[]>;
  current: Record<ConfigurableRole, PageKey[]>;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState(current);
  const dirty = ROLES.some(({ role }) => [...state[role]].sort().join() !== [...current[role]].sort().join());

  const toggle = (role: ConfigurableRole, key: PageKey) =>
    setState((s) => ({ ...s, [role]: s[role].includes(key) ? s[role].filter((k) => k !== key) : [...s[role], key] }));

  const save = () =>
    start(async () => {
      const r = await savePageAccessAction(state);
      if (r.ok) {
        toast.success(t("Saved"));
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{t("Switch pages on or off for each role. Turned-off pages disappear from the menu and cannot be opened. Admin always sees every page.")}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">{t("Page")}</th>
              <th className="w-20 py-2 text-center font-medium">{t("Admin")}</th>
              {ROLES.map(({ role, label }) => <th key={role} className="w-20 py-2 text-center font-medium">{t(label)}</th>)}
            </tr>
          </thead>
          <tbody>
            {NAV_ITEMS.map((item) => (
              <tr key={item.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{t(item.label)}</td>
                <td className="py-2 text-center"><Check className="mx-auto size-4 text-brand-600" aria-label={t("Always on")} /></td>
                {ROLES.map(({ role, label }) => {
                  const can = possible[role].includes(item.key);
                  return (
                    <td key={role} className="py-2 text-center">
                      {can ? (
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-600"
                          checked={state[role].includes(item.key)}
                          onChange={() => toggle(role, item.key)}
                          aria-label={`${t(item.label)} · ${t(label)}`}
                        />
                      ) : (
                        <Lock className="mx-auto size-3.5 text-slate-300" aria-label={t("Not available for this role")} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3" /> {t("Not available for this role (it would need Admin rights).")}</p>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty}>{pending ? t("Saving…") : t("Save page access")}</Button>
      </div>
    </div>
  );
}
