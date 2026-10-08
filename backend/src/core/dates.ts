// Calendar-date helpers. Dates are 'YYYY-MM-DD' strings in the user's local timezone.
// Pure functions used by the backend API and jobs.

export type ISODate = string;

const DAY_MS = 86_400_000;

/** Local calendar date for `now` in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Local wall-clock hour and minute for `now` in `timeZone`. */
export function localTimeIn(timeZone: string, now: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** b - a in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function weekdayName(d: ISODate): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(toUTC(d)).getUTCDay()
  ]!;
}

export function isValidISODate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTC(toUTC(d)) === d;
}

/** UTC offset of `timeZone` at `at`, e.g. '+05:30'. */
export function utcOffset(timeZone: string, at: Date = new Date()): string {
  // Computed from wall-clock parts (works on Hermes, which lacks timeZoneName: 'longOffset').
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const minutes = Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** ISO timestamp for local midnight of `day` in `timeZone`, e.g. '2026-10-07T00:00:00+05:30'. */
export function localMidnight(day: ISODate, timeZone: string): string {
  return `${day}T00:00:00${utcOffset(timeZone, new Date(`${day}T12:00:00Z`))}`;
}

/** ISO timestamp for a local wall-clock time on `day`. */
export function localDateTime(day: ISODate, time: string, timeZone: string): string {
  const hhmm = time.slice(0, 5);
  return `${day}T${hhmm}:00${utcOffset(timeZone, new Date(`${day}T12:00:00Z`))}`;
}

/** Minutes since midnight for an 'HH:MM' or 'HH:MM:SS' string. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** True when local time falls inside quiet hours (which may wrap past midnight). */
export function inQuietHours(nowMinutes: number, quietStart: string, quietEnd: string): boolean {
  const s = minutesOf(quietStart);
  const e = minutesOf(quietEnd);
  if (s === e) return false;
  return s < e ? nowMinutes >= s && nowMinutes < e : nowMinutes >= s || nowMinutes < e;
}
