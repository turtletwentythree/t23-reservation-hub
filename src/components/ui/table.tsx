import * as React from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("border-b bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b px-3 py-2 align-top", className)} {...props} />;
}
