/** Shown instantly while a staff page loads, so a click always gives feedback. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100">
        <div className="h-full w-1/3 animate-[loadbar_1s_ease-in-out_infinite] bg-brand-600" />
      </div>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
