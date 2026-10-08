import { dateLocale } from '@/i18n';

/** '7 Oct' style label for a YYYY-MM-DD date, in the UI language. */
export function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function longDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function monthTitle(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function weekdayInitials(): string[] {
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(dateLocale(), { weekday: 'narrow', timeZone: 'UTC' }));
}

export function addDays(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Today's date (YYYY-MM-DD) in a timezone, default the browser's. */
export function todayIn(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export const hhmm = (t: string) => t.slice(0, 5);

export function uuid(): string {
  return crypto.randomUUID();
}

export function mealForHour(hour: number = new Date().getHours()): 'breakfast' | 'lunch' | 'snack' | 'dinner' {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snack';
  return 'dinner';
}
