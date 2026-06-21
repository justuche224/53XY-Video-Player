export interface DayBucket {
  key: string;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayBucket(timestampMs: number, nowMs: number): DayBucket {
  const day = startOfLocalDay(timestampMs);
  const today = startOfLocalDay(nowMs);
  const key = String(day);
  const diffDays = Math.round((today - day) / DAY_MS);

  if (diffDays <= 0) return { key, label: 'Today' };
  if (diffDays === 1) return { key, label: 'Yesterday' };

  const d = new Date(timestampMs);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const label = d.getFullYear() === new Date(nowMs).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
  return { key, label };
}
