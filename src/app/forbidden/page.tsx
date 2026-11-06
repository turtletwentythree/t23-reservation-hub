import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-bold text-accent-500">403</p>
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted">Ask an Admin to update your role or branch access.</p>
      <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:underline">Back to dashboard</Link>
    </div>
  );
}
