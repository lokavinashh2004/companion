import { assertEquals } from './assert.ts';
import { test } from 'vitest';
import { findPatterns, phaseOf } from '../src/core/patterns.ts';
import { addDays } from '../src/core/dates.ts';

const periods = [
  { start_date: '2026-06-01', end_date: '2026-06-05' },
  { start_date: '2026-07-01', end_date: '2026-07-05' },
  { start_date: '2026-07-31', end_date: '2026-08-04' },
  { start_date: '2026-08-30', end_date: '2026-09-03' },
];

test('phaseOf', () => {
  assertEquals(phaseOf('2026-06-03', periods), 'menstrual');
  assertEquals(phaseOf('2026-06-10', periods), 'follicular');
  assertEquals(phaseOf('2026-06-25', periods), 'luteal');
  assertEquals(phaseOf('2026-09-10', periods), null); // current cycle isn't complete
});

test('no patterns under 3 completed cycles', () => {
  assertEquals(findPatterns({ periods: periods.slice(0, 3), moods: [], symptoms: [], sugarByDay: [] }), []);
});

test('mood dips and cravings in luteal phase are found', () => {
  const moods = [];
  const symptoms = [];
  for (let d = '2026-06-01'; d < '2026-08-30'; d = addDays(d, 1)) {
    const ph = phaseOf(d, periods);
    moods.push({ day: d, mood: ph === 'luteal' ? 2 : 4 });
    if (ph === 'luteal' && /[5-8]$/.test(d)) symptoms.push({ day: d, symptom: 'cravings' });
  }
  const kinds = findPatterns({ periods, moods, symptoms, sugarByDay: [] }).map((p) => p.kind);
  assertEquals(kinds, ['mood_by_phase', 'cravings_luteal']);
});
