"use client";
import { useRef } from "react";

/** A GET filter form that reloads as soon as a field changes (no "Show" click needed). */
export function AutoSubmitForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} className={className} onChange={() => ref.current?.requestSubmit()}>
      {children}
    </form>
  );
}
