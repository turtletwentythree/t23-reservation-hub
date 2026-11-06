import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-white shadow-xs", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-2 p-4 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-slate-800", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2", className)} {...props} />;
}

export function Badge({ className, tone = "slate", ...props }: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "slate" | "green" | "orange" | "red" | "blue" | "purple" | "yellow" | "brand";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    brand: "bg-brand-100 text-brand-800",
    orange: "bg-accent-100 text-accent-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-800",
    purple: "bg-purple-100 text-purple-800",
    yellow: "bg-amber-100 text-amber-800",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "brand" | "accent" | "red" | "slate" }) {
  const color = tone === "accent" ? "text-accent-600" : tone === "red" ? "text-red-600" : tone === "slate" ? "text-slate-800" : "text-brand-600";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 break-words text-xl font-semibold tabular-nums xl:text-2xl", color)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
