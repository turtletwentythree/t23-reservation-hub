"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bell, BookOpen, CalendarDays, LayoutDashboard, LayoutGrid, ListOrdered, Plug, ScrollText, Settings, Store, UserCog, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { BarChart3, Bell, BookOpen, CalendarDays, LayoutDashboard, LayoutGrid, ListOrdered, Plug, ScrollText, Settings, Store, UserCog, Users };

export function Sidebar({ items, open, onClose }: {
  items: { href: string; label: string; icon: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      {open ? <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 text-brand-50 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-500 text-sm font-bold text-white">T23</span>
            <span>Reservation Hub</span>
          </Link>
          <button className="rounded p-1 hover:bg-brand-800 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS];
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-brand-700 font-medium text-white" : "text-brand-100 hover:bg-brand-800",
                )}
              >
                {Icon ? <Icon className={cn("size-4", active ? "text-accent-300" : "")} /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[11px] text-brand-300">Turtle23 Restaurant Group</div>
      </aside>
    </>
  );
}
