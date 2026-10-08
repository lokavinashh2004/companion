import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Today } from '@/routes/Today';
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
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await act(() => i18n.changeLanguage('en'));
});

it('shows score, highlights, meals and an estimate tag, with kcal hidden by default', async () => {
  mockApi({ 'GET /today': TODAY });
  renderPage(<Today />);
  expect(await screen.findByText('7/10')).toBeTruthy();
  expect(screen.getByText('✓ good protein today')).toBeTruthy();
  expect(screen.getByText('Idea: a small bowl of kootu or poriyal')).toBeTruthy();
  expect(screen.getByText('Breakfast')).toBeTruthy();
  expect(screen.getByText('Lunch')).toBeTruthy();
  expect(screen.getByText('Idli')).toBeTruthy();
  expect(screen.getByText('× 3 pieces')).toBeTruthy();
  expect(screen.getAllByText('estimate')).toHaveLength(1);
  expect(screen.queryByText(/kcal/)).toBeNull();
  // cycle card shows a range, not a single date
  expect(screen.getByText('Cycle day 12')).toBeTruthy();
  expect(screen.getByText('Low confidence')).toBeTruthy();
  expect(screen.getByText('PCOS cycles often vary, so this is a range.')).toBeTruthy();
  expect(screen.getByRole('link', { name: /See your insights/ }).getAttribute('href')).toBe('/insights');
});

it('shows kcal only when the profile opts in', async () => {
  mockApi({ 'GET /today': { ...TODAY, calorie_display: 'show' } });
  renderPage(<Today />);
  expect(await screen.findByText('120 kcal')).toBeTruthy();
  expect(screen.getByText('400 kcal')).toBeTruthy();
});

it('shows a friendly empty state with a way to chat when nothing is logged', async () => {
  mockApi({ 'GET /today': { ...TODAY, foods: [], score: null } });
  renderPage(<Today />, { route: '/today', path: '/today' });
  expect(await screen.findByText(/Nothing logged yet/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tell me in chat' }));
  expect(await screen.findByText('other page')).toBeTruthy();
});

it('adds 250 ml of water', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /today/water': { day: DAY, ml: 750 } });
  renderPage(<Today />);
  fireEvent.click(await screen.findByRole('button', { name: '+250 ml' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/today/water')?.body).toEqual({ day: DAY, ml: 250 }));
});

it('marks a medicine dose as taken', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /meds/{id}/dose': { ok: true } });
  renderPage(<Today />);
  fireEvent.click(await screen.findByRole('switch', { name: /Metformin 500 mg · 08:00/ }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/meds/med1/dose')?.body).toEqual({ day: DAY, time: '08:00', taken: true }));
});

it('removes a food item after confirming', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'DELETE /food/logs/{id}': { ok: true } });
  renderPage(<Today />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove Idli' }));
  expect(screen.getByText('Remove Idli?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/food/logs/f1')).toBe(true));
});

it('quick log sends the chosen values and confirms', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'POST /today/quick-log': { ok: true } });
  renderPage(<Today />);
  await screen.findByText('7/10');
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

it('asks for weekly weight only when due', async () => {
  const calls = mockApi({ 'GET /today': { ...TODAY, weight_due: true }, 'POST /today/weight': { ok: true } });
  renderPage(<Today />);
  fireEvent.change(await screen.findByLabelText('Weight (kg)'), { target: { value: '64.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save weight' }));
  await waitFor(() => expect(calls.find((c) => c.path === '/today/weight')?.body).toEqual({ day: DAY, weight_kg: 64.5 }));
});

it('renders in Tamil', async () => {
  mockApi({ 'GET /today': TODAY });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Today />);
  expect(await screen.findByText('7/10')).toBeTruthy();
  expect(screen.getByRole('link', { name: /உங்கள் பார்வைகளைக் காணுங்கள்/ })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'உணவு சமநிலை' })).toBeTruthy();
  expect(screen.queryByText('Food balance')).toBeNull();
});
