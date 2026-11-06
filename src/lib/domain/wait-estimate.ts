/**
 * Waiting-time estimate for walk-ins: for each queued party (in queue order), find the
 * earliest moment a table that fits frees up, given current/upcoming occupancy, and
 * "reserve" it for that party so later parties queue behind. Pure + unit tested.
 */
export interface EstTable { id: string; min_capacity: number; max_capacity: number; usable: boolean }
export interface EstBusy { table_id: string; until: number }
export interface EstParty { id: string; party_size: number }

export function estimateWaits(parties: EstParty[], tables: EstTable[], busy: EstBusy[], now: number, buffer = 10 * 60_000): Map<string, number | null> {
  const freeAt = new Map<string, number>();
  for (const t of tables) if (t.usable) freeAt.set(t.id, now);
  for (const b of busy) if (freeAt.has(b.table_id)) freeAt.set(b.table_id, Math.max(freeAt.get(b.table_id)!, b.until + buffer));
  const result = new Map<string, number | null>();
  for (const p of parties) {
    const fits = tables.filter((t) => t.usable && p.party_size <= t.max_capacity).sort((a, b) => a.max_capacity - b.max_capacity);
    if (fits.length === 0) {
      result.set(p.id, null);
      continue;
    }
    let best = fits[0];
    for (const t of fits) if (freeAt.get(t.id)! < freeAt.get(best.id)!) best = t;
    const at = freeAt.get(best.id)!;
    result.set(p.id, Math.max(0, Math.round((at - now) / 60_000)));
    freeAt.set(best.id, at + 75 * 60_000); // assume a typical walk-in turn of 75 minutes
  }
  return result;
}
