import { assertEquals, assert } from './assert.ts';
import { test } from 'vitest';
import {
  contributingFactors,
  cycleLengths,
  cycleStatus,
  dueDelayKey,
  iqr,
  median,
  predictNextPeriod,
  redFlags,
  shouldAutoClose,
  stdDev,
  usableLengths,
  type FactorInput,
} from '../src/core/cycle.ts';
import { addDays } from '../src/core/dates.ts';

function startsFrom(first: string, lengths: number[]): string[] {
  const out = [first];
  for (const l of lengths) out.push(addDays(out.at(-1)!, l));
  return out;
}

test('stats helpers', () => {
  assertEquals(median([30, 28, 35]), 30);
  assertEquals(median([28, 30, 32, 40]), 31);
  assertEquals(iqr([28]), 0);
  assertEquals(iqr([28, 30, 32, 34, 36]), 4);
  assertEquals(stdDev([30]), 0);
  assert(Math.abs(stdDev([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01);
});

test('no start dates -> no prediction', () => {
  assertEquals(predictNextPeriod([], 30), null);
});

test('0 cycles uses typical length, low confidence, wide window', () => {
  const p = predictNextPeriod(['2026-09-01'], 32)!;
  assertEquals(p.cyclesUsed, 0);
  assertEquals(p.likely, '2026-10-03');
  assertEquals(p.earliest, '2026-09-26');
  assertEquals(p.latest, '2026-10-10');
  assertEquals(p.confidence, 'low');
});

test('0 cycles and "not sure" defaults to 35 days', () => {
  const p = predictNextPeriod(['2026-09-01'], null)!;
  assertEquals(p.medianLength, 35);
  assertEquals(p.likely, '2026-10-06');
  assertEquals(p.confidence, 'low');
});

test('1 cycle: uses its length, still low confidence', () => {
  const p = predictNextPeriod(startsFrom('2026-08-01', [33]), 28)!;
  assertEquals(p.cyclesUsed, 1);
  assertEquals(p.medianLength, 33);
  assertEquals(p.confidence, 'low');
  assertEquals(p.spread, 7);
});

test('3 regular cycles -> medium confidence', () => {
  const starts = startsFrom('2026-06-01', [30, 31, 32]);
  const p = predictNextPeriod(starts, null)!;
  assertEquals(p.cyclesUsed, 3);
  assertEquals(p.medianLength, 31);
  assertEquals(p.spread, 3);
  assertEquals(p.confidence, 'medium');
  assertEquals(p.likely, addDays(starts.at(-1)!, 31));
  assertEquals(p.earliest, addDays(starts.at(-1)!, 28));
  assertEquals(p.latest, addDays(starts.at(-1)!, 34));
});

test('6+ regular cycles -> high confidence, only last 6 used', () => {
  const starts = startsFrom('2025-10-01', [50, 29, 30, 29, 30, 31, 30]);
  const p = predictNextPeriod(starts, null)!;
  assertEquals(p.cyclesUsed, 6);
  assertEquals(p.medianLength, 30);
  assertEquals(p.confidence, 'high');
});

test('irregular PCOS-like cycles -> wide window, low confidence', () => {
  const starts = startsFrom('2025-09-01', [32, 45, 38, 60, 41, 35]);
  const p = predictNextPeriod(starts, null)!;
  assertEquals(p.cyclesUsed, 6);
  assertEquals(p.medianLength, 40); // median of 32,35,38,41,45,60 = 39.5 -> 40
  assert(p.spread >= 9);
  assertEquals(p.confidence, 'low');
});

test('lengths under 15 days are kept in history but not used', () => {
  const starts = startsFrom('2026-05-01', [30, 10, 22, 31]);
  assertEquals(cycleLengths(starts), [30, 10, 22, 31]);
  assertEquals(usableLengths(cycleLengths(starts)), [30, 22, 31]);
  assertEquals(predictNextPeriod(starts, null)!.cyclesUsed, 3);
});

test('cycleStatus: ongoing, regular, late', () => {
  const periods = [{ start_date: '2026-09-01', end_date: null }];
  const pred = predictNextPeriod(['2026-09-01'], 30)!;
  assertEquals(cycleStatus('2026-09-03', periods, pred), { kind: 'period', periodDay: 3, cycleDay: 3, phase: 'menstrual' });
  const closed = [{ start_date: '2026-09-01', end_date: '2026-09-05' }];
  assertEquals(cycleStatus('2026-09-08', closed, pred).kind, 'cycle');
  const late = cycleStatus(addDays(pred.latest, 3), closed, pred);
  assertEquals(late.kind, 'late');
  if (late.kind === 'late') assertEquals(late.daysLate, 3);
});

test('auto-close after 10 days', () => {
  assertEquals(shouldAutoClose('2026-09-01', '2026-09-10'), false);
  assertEquals(shouldAutoClose('2026-09-01', '2026-09-11'), true);
});

test('delay check-ins at day 1, 7, 14 only', () => {
  assertEquals(dueDelayKey(0), null);
  assertEquals(dueDelayKey(1), 'late-0');
  assertEquals(dueDelayKey(6), 'late-0');
  assertEquals(dueDelayKey(7), 'late-7');
  assertEquals(dueDelayKey(20), 'late-14');
});

function baseFactors(): FactorInput {
  return {
    expectedStart: '2026-10-01',
    today: '2026-10-10',
    lastStart: '2026-08-25',
    historyLengths: [32, 35],
    moods: [],
    lifestyle: [],
    weights: [],
    medications: [],
    intakeByDay: [],
  };
}

test('factors: none when no data', () => {
  assertEquals(contributingFactors(baseFactors()), []);
});

test('factors: stress, sleep, illness, meds, weight, usual pattern', () => {
  const f = baseFactors();
  f.historyLengths = [32, 50];
  for (let i = 0; i < 8; i++) f.moods.push({ day: addDays('2026-09-01', i), stress: 5 });
  for (let i = 0; i < 15; i++) {
    f.lifestyle.push({ day: addDays('2026-09-05', i), sleep_hours: 5, exercise_minutes: 0, illness: i === 3, travel: null });
  }
  f.weights = [{ day: '2026-08-20', weight_kg: 60 }, { day: '2026-09-28', weight_kg: 63.5 }];
  f.medications = [{ start_date: '2026-09-10', end_date: null }];
  const out = contributingFactors(f);
  for (const id of ['high_stress', 'poor_sleep', 'illness_or_travel', 'medication_change', 'weight_change', 'usual_pattern']) {
    assert(out.includes(id as never), `missing ${id}`);
  }
});

test('factors: exercise doubled and low intake days', () => {
  const f = baseFactors();
  for (let i = 0; i < 28; i++) f.lifestyle.push({ day: addDays('2026-08-27', i), sleep_hours: null, exercise_minutes: 10, illness: null, travel: null });
  for (let i = 0; i < 7; i++) f.lifestyle.push({ day: addDays('2026-09-25', i), sleep_hours: null, exercise_minutes: 40, illness: null, travel: null });
  for (let i = 0; i < 15; i++) f.intakeByDay.push({ day: addDays('2026-09-01', i), kcal: i < 5 ? 600 : 1800 });
  const out = contributingFactors(f);
  assert(out.includes('exercise_change'));
  assert(out.includes('low_intake_days'));
});

test('red flags', () => {
  const flags = redFlags({
    today: '2026-12-15',
    periods: [
      { start_date: '2026-08-01', end_date: '2026-08-11', flow: 'heavy', pain: 9 },
      { start_date: '2026-09-01', end_date: '2026-09-05', flow: 'medium', pain: 3 },
    ],
    symptoms: [
      { day: '2026-09-15', symptom: 'spotting', severity: 1 },
      { day: '2026-09-16', symptom: 'spotting', severity: 1 },
      { day: '2026-09-18', symptom: 'spotting', severity: 1 },
      { day: '2026-09-20', symptom: 'pelvic_pain', severity: 3 },
      { day: '2026-09-03', symptom: 'pelvic_pain', severity: 3 }, // during period -> ignored
    ],
  });
  const rules = flags.map((f) => f.rule).sort();
  assertEquals(rules, ['heavy_bleeding', 'intermenstrual_bleeding', 'long_bleeding', 'no_period_90', 'severe_pelvic_pain']);
});
