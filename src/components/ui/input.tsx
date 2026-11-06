"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Field provides an id so its label is programmatically linked to the control inside it. */
const FieldId = React.createContext<string | undefined>(undefined);
const useFieldId = (id?: string) => { const ctx = React.useContext(FieldId); return id ?? ctx; };

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, id, ...props }, ref) => (
  <input
    ref={ref}
    id={useFieldId(id)}
    className={cn(
      "flex h-9 w-full rounded-lg border bg-white px-3 py-1 text-sm shadow-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, ...props }, ref) => (
    <textarea
      ref={ref}
      id={useFieldId(id)}
      className={cn(
        "flex min-h-[72px] w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, id, ...props }, ref) => (
    <select
      ref={ref}
      id={useFieldId(id)}
      className={cn(
        "flex h-9 w-full rounded-lg border bg-white px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-slate-700", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const auto = React.useId();
  const id = htmlFor ?? auto;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <FieldId.Provider value={id}>{children}</FieldId.Provider>
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
