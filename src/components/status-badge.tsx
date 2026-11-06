"use client";
import { Badge } from "@/components/ui/card";
import { STATUS_META } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";
import { useT } from "@/components/staff-locale";

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status];
  const t = useT();
  return <Badge tone={meta.tone}>{t(meta.label)}</Badge>;
}
