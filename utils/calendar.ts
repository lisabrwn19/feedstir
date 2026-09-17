/** YYYY-MM-DD in local time — avoids the off-by-one-day bugs `toISOString()` causes near midnight/UTC boundaries. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export type CalendarDay = { date: Date; iso: string; inMonth: boolean };

/** Always 42 cells (6 full weeks, Sunday-start) so the grid height never jumps between months. */
export function buildMonthGrid(monthStart: Date): CalendarDay[] {
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - monthStart.getDay());
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    days.push({ date, iso: toISODate(date), inMonth: date.getMonth() === monthStart.getMonth() });
  }
  return days;
}

export function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function isDateInRange(iso: string, start: string | undefined, end: string | undefined): boolean {
  if (!start) return false;
  const rangeEnd = end ?? start;
  return iso >= start && iso <= rangeEnd;
}

/** e.g. "Sep 14" for a single day, "Sep 14 – Sep 20" for a range. Undefined if no start date is set. */
export function formatDateRangeLabel(start: string | undefined, end: string | undefined): string | undefined {
  if (!start) return undefined;
  const fmt = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}
