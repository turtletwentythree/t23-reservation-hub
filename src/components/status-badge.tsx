import { Badge } from "@/components/ui/card";
import { STATUS_META } from "@/lib/domain/status";
import type { ReservationStatus } from "@/lib/supabase/types";

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
