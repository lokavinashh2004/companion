import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Today } from '@/routes/Today';
import { TodaySection } from '@/routes/TodaySection';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const DAY = '2026-10-08';

const food = (o: Record<string, unknown>) => ({
  id: 'f1',
  day: DAY,
  meal: 'breakfast',
  item_name: 'Idli',
  quantity: 3,
  unit: 'pieces',
  grams: 150,
  kcal: 120,
  protein_g: 6,
  carbs_g: 24,
  fiber_g: 2,
  added_sugar_g: 0,
  veg_g: 0,
  gi_band: 'medium',
  is_estimate: true,
  source: 'text',
  ...o,
});

const TODAY = {
  day: DAY,
  calorie_display: 'hide',
  status: { kind: 'cycle', cycle_day: 12, period_day: null, days_late: null, phase: 'follicular' },
  prediction: { earliest: '2026-10-24', likely: '2026-10-27', latest: '2026-10-31', confidence: 'low', cycles_used: 2 },
  foods: [food({}), food({ id: 'f2', meal: 'lunch', item_name: 'Sambar rice', quantity: 1, unit: 'plate', kcal: 400, is_estimate: false })],
  score: { score: 7, highlights: ['protein'], idea: 'add_veggies', kcal: 520 },
  moods: [{ id: 'm1', mood: 4, energy: 3, stress: 2 }],
  symptoms: [{ id: 's1', symptom: 'bloating', severity: 2 }],
  lifestyle: { water_ml: 500, sleep_hours: 7.5, exercise_minutes: null, steps: null },
  meds: [
    {
      medication: { id: 'med1', name: 'Metformin', dose: '500 mg', schedule_times: ['08:00'], active: true, start_date: null, end_date: null },
      doses: [{ time: '08:00', taken: false }],
    },
  ],
  weight_due: false,
  progress: { percent: 46, complete: false, food: { done: 2, goal: 3 }, water: { done: 500, goal: 2000 }, steps: { done: 2400, goal: 5000 } },
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await act(() => i18n.changeLanguage('en'));
});

const section = (name: string) => renderPage(<TodaySection />, { route: `/today/${name}`, path: '/today/:section' });
const tile = (name: RegExp) => screen.getByRole('link', { name });

// ---------------------------------------------------------------- hub

it('shows one tile per area with a summary of today, each opening its own screen', async () => {
  mockApi({ 'GET /today': TODAY });
  renderPage(<Today />);
  expect(await screen.findByRole('list', { name: 'Your day' })).toBeTruthy();
  expect(tile(/^Food: 2\/3 meals · 7\/10 balance$/).getAttribute('href')).toBe('/today/food');
  expect(tile(/^Water: 2 of 8 glasses$/).getAttribute('href')).toBe('/today/water');
  expect(tile(/^Medicines: 0 of 1 taken$/).getAttribute('href')).toBe('/today/meds');
  expect(tile(/^Mood & symptoms: .+ Feeling 4 of 5 · 1 symptom$/).getAttribute('href')).toBe('/today/mood');
  expect(tile(/^Walk: 2,400 steps today$/).getAttribute('href')).toBe('/today/walk');
  expect(tile(/^Period tracker: Cycle day 12$/).getAttribute('href')).toBe('/cycle');
  expect(tile(/^Sleep & stress: .*7\.5.* · Low stress$/).getAttribute('href')).toBe('/insights');
  // the details live on the section screens, not the hub
  expect(screen.queryByText('Idli')).toBeNull();
  expect(screen.queryByRole('button', { name: '+250 ml' })).toBeNull();
  // weight only when due
  expect(screen.queryByRole('link', { name: /^Weight/ })).toBeNull();
});

it("shows today's goals: one bar for the day and a pill per goal", async () => {
  mockApi({ 'GET /today': TODAY });
  renderPage(<Today />);
  const bar = await screen.findByRole('progressbar', { name: "Today's goals" });
  expect(bar.getAttribute('aria-valuenow')).toBe('46');
  expect(screen.getByText('46%')).toBeTruthy();
  expect(screen.getByText('0 of 3 goals done')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Meals: 2/3 meals' }).getAttribute('href')).toBe('/today/food');
  expect(screen.getByRole('link', { name: 'Water: 2/8 glasses' }).getAttribute('href')).toBe('/today/water');
  expect(screen.getByRole('link', { name: 'Steps: 2.4k of 5k steps' }).getAttribute('href')).toBe('/today/walk');
  expect(screen.getByRole('link', { name: /Goal calendar/ }).getAttribute('href')).toBe('/today/goals');
});

it('celebrates when every goal is met', async () => {
  const progress = { percent: 100, complete: true, food: { done: 4, goal: 3 }, water: { done: 2250, goal: 2000 }, steps: { done: 5100, goal: 5000 } };
  mockApi({ 'GET /today': { ...TODAY, progress } });
  renderPage(<Today />);
  expect(await screen.findByText('All goals done today 🎉')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Meals: 3/3 meals, done' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Steps: 5.1k of 5k steps, done' })).toBeTruthy();
});

it('tiles show friendly prompts when nothing is logged, a weight tile when due, and a late badge', async () => {
  mockApi({
    'GET /today': {
      ...TODAY,
      foods: [],
      score: null,
      moods: [],
      symptoms: [],
      lifestyle: null,
      meds: [],
      weight_due: true,
      progress: { percent: 0, complete: false, food: { done: 0, goal: 3 }, water: { done: 0, goal: 2000 }, steps: { done: 0, goal: 5000 } },
      status: { kind: 'late', cycle_day: 38, period_day: null, days_late: 3, phase: 'late' },
    },
  });
  renderPage(<Today />);
  expect(await screen.findByRole('link', { name: 'Food: Nothing logged yet' })).toBeTruthy();
  expect(tile(/^Medicines: Add your medicines$/)).toBeTruthy();
  expect(tile(/^Mood & symptoms: How are you feeling\?$/)).toBeTruthy();
  expect(tile(/^Walk: Start a walk$/)).toBeTruthy();
  expect(tile(/^Period tracker: 3 days late$/)).toBeTruthy();
  expect(screen.getByText('Late')).toBeTruthy();
  expect(tile(/^Weight: Weekly check-in due$/).getAttribute('href')).toBe('/today/weight');
});

it('flags a missed medicine dose on its tile', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 11, 0));
  try {
    mockApi({ 'GET /today': TODAY });
    renderPage(<Today />);
    expect(await screen.findByText('Missed')).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it('quick log from the hub sends the chosen values and confirms', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /today/quick-log': { ok: true } });
  renderPage(<Today />);
  await screen.findByRole('list', { name: 'Your day' });
  fireEvent.click(screen.getByRole('button', { name: /Quick log/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Mood 4 of 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Energy 2 of 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Stress 5 of 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cramps' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add sleep' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sleep last night +' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === 'POST' && c.path === '/today/quick-log')?.body).toEqual({
      day: DAY,
      mood: 4,
      energy: 2,
      stress: 5,
      symptoms: ['cramps'],
      sleep_hours: 7.5,
    }),
  );
  expect(await screen.findByText('Logged ✓')).toBeTruthy();
});

it('renders the hub in Tamil', async () => {
  mockApi({ 'GET /today': TODAY });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Today />);
  expect(await screen.findByRole('list', { name: 'உங்கள் நாள்' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'உணவு' })).toBeTruthy();
  expect(screen.queryByText('Food')).toBeNull();
});

// ---------------------------------------------------------------- section screens

it('food: score, highlights, meals and an estimate tag, with kcal hidden by default', async () => {
  mockApi({ 'GET /today': TODAY });
  section('food');
  expect(await screen.findByText('7/10')).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Food' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '‹ Today' }).getAttribute('href')).toBe('/today');
  expect(screen.getByText('✓ good protein today')).toBeTruthy();
  expect(screen.getByText('Idea: a small bowl of kootu or poriyal')).toBeTruthy();
  expect(screen.getByText('Breakfast')).toBeTruthy();
  expect(screen.getByText('Lunch')).toBeTruthy();
  expect(screen.getByText('Idli')).toBeTruthy();
  expect(screen.getByText('× 3 pieces')).toBeTruthy();
  expect(screen.getAllByText('estimate')).toHaveLength(1);
  expect(screen.queryByText(/kcal/)).toBeNull();
});

it('food: kcal only when the profile opts in', async () => {
  mockApi({ 'GET /today': { ...TODAY, calorie_display: 'show' } });
  section('food');
  expect(await screen.findByText('120 kcal')).toBeTruthy();
  expect(screen.getByText('400 kcal')).toBeTruthy();
});

it('food: a friendly empty state with a way to chat when nothing is logged', async () => {
  mockApi({ 'GET /today': { ...TODAY, foods: [], score: null } });
  section('food');
  expect(await screen.findByText(/Nothing logged yet/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tell me in chat' }));
  expect(await screen.findByText('other page')).toBeTruthy();
});

it('food: removes an item after confirming', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'DELETE /food/logs/{id}': { ok: true } });
  section('food');
  fireEvent.click(await screen.findByRole('button', { name: 'Remove Idli' }));
  expect(screen.getByText('Remove Idli?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/food/logs/f1')).toBe(true));
});

it('water: adds 250 ml', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /today/water': { day: DAY, ml: 750 } });
  section('water');
  fireEvent.click(await screen.findByRole('button', { name: '+250 ml' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/today/water')?.body).toEqual({ day: DAY, ml: 250 }));
});

it('medicines: marks a dose as taken', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /meds/{id}/dose': { ok: true } });
  section('meds');
  fireEvent.click(await screen.findByRole('switch', { name: /Metformin 500 mg · 08:00/ }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/meds/med1/dose')?.body).toEqual({ day: DAY, time: '08:00', taken: true }));
  expect(screen.getByRole('link', { name: /Manage medicines/ }).getAttribute('href')).toBe('/me/medications');
});

it('mood: logs a mood with one tap and opens the full check-in', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /today/quick-log': { ok: true } });
  section('mood');
  fireEvent.click(await screen.findByRole('button', { name: 'Log mood 2 of 5' }));
  await waitFor(() => expect(calls.find((c) => c.path === '/today/quick-log')?.body).toEqual({ day: DAY, mood: 2 }));
  fireEvent.click(screen.getByRole('button', { name: /Log energy, stress/ }));
  expect(await screen.findByRole('button', { name: 'Energy 2 of 5' })).toBeTruthy();
});

it('weight: asks only when due', async () => {
  const calls = mockApi({ 'GET /today': { ...TODAY, weight_due: true }, 'POST /today/weight': { ok: true } });
  section('weight');
  fireEvent.change(await screen.findByLabelText('Weight (kg)'), { target: { value: '64.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save weight' }));
  await waitFor(() => expect(calls.find((c) => c.path === '/today/weight')?.body).toEqual({ day: DAY, weight_kg: 64.5 }));
});

it('weight: says so when no weigh-in is due', async () => {
  mockApi({ 'GET /today': TODAY });
  section('weight');
  expect(await screen.findByText(/No weigh-in due this week/)).toBeTruthy();
});

it('an unknown section shows not found', async () => {
  mockApi({ 'GET /today': TODAY });
  section('nope');
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
});
