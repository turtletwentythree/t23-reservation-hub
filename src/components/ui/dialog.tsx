"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, title, description, side }: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  /** "right" renders as a drawer (used for guest profiles / reservation details). */
  side?: "right";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-xl focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-xl"
            : "left-1/2 top-1/2 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl",
          className,
        )}
      >
        <div className="flex items-start justify-between border-b px-5 py-3">
          <div>
            <DialogPrimitive.Title className="font-semibold text-slate-900">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
