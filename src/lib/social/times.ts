// Pure best-time heuristics (client-safe — no env, no server imports).

const BEST_HOURS: Record<string, number[]> = {
  instagram: [11, 14, 19],
  linkedin: [8, 12, 17],
  x: [9, 12, 18],
  facebook: [9, 13, 19],
  tiktok: [12, 19, 21],
};

/** Suggest the next few good slots for a platform from a starting date (ISO strings). */
export function suggestSlots(platform: string, from: Date = new Date(), count = 3): string[] {
  const hours = BEST_HOURS[platform] ?? [10, 14, 19];
  const out: string[] = [];
  let day = 0;
  while (out.length < count && day < 14) {
    const base = new Date(from);
    base.setDate(base.getDate() + day);
    for (const h of hours) {
      const slot = new Date(base);
      slot.setHours(h, 0, 0, 0);
      if (slot.getTime() > from.getTime()) out.push(slot.toISOString());
      if (out.length >= count) break;
    }
    day++;
  }
  return out;
}

/** For a datetime-local input value (local time, no seconds). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
