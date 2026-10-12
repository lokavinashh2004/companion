import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { TodaySection } from '@/routes/TodaySection';
import { mockApi, PROFILE, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const DAY = '2026-10-08';
const TODAY = {
  day: DAY,
  calorie_display: 'show',
  status: { kind: 'none', cycle_day: null, period_day: null, days_late: null, phase: null },
  prediction: null,
  foods: [],
  score: null,
  moods: [],
  symptoms: [],
  lifestyle: null,
  meds: [],
  weight_due: false,
  progress: { percent: 0, complete: false, food: { done: 0, goal: 3 }, water: { done: 0, goal: 2000 }, steps: { done: 0, goal: 5000 } },
};
const week = ['2026-10-05', '2026-10-06', '2026-10-07', DAY].map((day, i) => ({ day, kcal: [1700, 2100, 0, 1240][i]! }));
const CALORIES = {
  hidden: false,
  target: 1800,
  target_is_default: true,
  today: { day: DAY, kcal: 1240, by_meal: [{ meal: 'breakfast', kcal: 340 }, { meal: 'lunch', kcal: 900 }], unknown_items: 1 },
  week: { from: '2026-10-05', days: week, total: 5040, average: 1680 },
  month: { from: '2026-10-01', days: Array.from({ length: 8 }, (_, i) => ({ day: `2026-10-0${i + 1}`, kcal: i === 7 ? 1240 : 1500 })), total: 11740, average: 1468 },
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const food = () => renderPage(<TodaySection />, { route: '/today/food', path: '/today/:section' });

it("shows today's calories against the guide, what's left and the split by meal", async () => {
  mockApi({ 'GET /today': TODAY, 'GET /food/calories': CALORIES });
  food();
  expect(await screen.findByText('1,240')).toBeTruthy();
  expect(screen.getByText('of 1,800 kcal')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: /Calories today/ }).getAttribute('aria-valuenow')).toBe('1240');
  expect(screen.getByText('560 kcal left today')).toBeTruthy();
  const meals = within(screen.getByRole('list', { name: 'Calories by meal' }));
  expect(meals.getByText('340')).toBeTruthy();
  expect(meals.getByText('900')).toBeTruthy();
  expect(screen.getByText(/1 item has no calorie information/)).toBeTruthy();
  expect(screen.getByText(/Daily guide: 1,800 kcal \(a general guide\)/)).toBeTruthy();
});

it('charts this week and this month with totals, average and days over the guide', async () => {
  mockApi({ 'GET /today': TODAY, 'GET /food/calories': CALORIES });
  food();
  expect(await screen.findByRole('img', { name: 'This week: Calories' })).toBeTruthy();
  expect(screen.getByText('5,040')).toBeTruthy();
  expect(screen.getByText('1,680')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy(); // one day (2,100) over 1,800
  fireEvent.click(screen.getByRole('button', { name: 'This month' }));
  expect(screen.getByRole('img', { name: 'This month: Calories' })).toBeTruthy();
  expect(screen.getByText('11,740')).toBeTruthy();
  expect(screen.getByText('1,468')).toBeTruthy();
});

it('warns when over the guide', async () => {
  mockApi({ 'GET /today': TODAY, 'GET /food/calories': { ...CALORIES, today: { ...CALORIES.today, kcal: 2000 } } });
  food();
  expect(await screen.findByText('200 kcal over your guide')).toBeTruthy();
});

it('changes the daily guide, or goes back to the general one', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'GET /food/calories': CALORIES, 'PATCH /me': { ...PROFILE, calorie_target: 1600 } });
  food();
  fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
  fireEvent.change(screen.getByLabelText('Calories per day (kcal)'), { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText(/between 1,000 and 4,000/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Calories per day (kcal)'), { target: { value: '1600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ calorie_target: 1600 }));
});

it('offers to turn calories on when they are off', async () => {
  const calls = mockApi({
    'GET /today': { ...TODAY, calorie_display: 'hide' },
    'GET /food/calories': { hidden: true, target: 1800, target_is_default: true, today: null, week: null, month: null },
    'PATCH /me': { ...PROFILE, calorie_display: 'show' },
  });
  food();
  expect(await screen.findByText(/Calories are turned off/)).toBeTruthy();
  expect(screen.queryByRole('img', { name: /Calories/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show calories' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ calorie_display: 'show' }));
});

it('logs food by hand with suggestions, a live calorie preview and portion size', async () => {
  const calls = mockApi({
    'GET /today': TODAY,
    'GET /food/calories': CALORIES,
    'GET /food/search': { results: [{ name: 'idli', kcal_per_100g: 146, serving_g: 120, piece_g: 40 }, { name: 'idiyappam', kcal_per_100g: 150, serving_g: 100, piece_g: 30 }] },
    'POST /food/estimate': (b: unknown) => {
      const body = b as { quantity: number; unit: string };
      const grams = body.quantity * (body.unit === 'large piece' ? 56 : 40);
      return { found: true, name: 'idli', grams, kcal: Math.round(grams * 1.46), is_estimate: false };
    },
    'POST /food/logs': { logs: [] },
  });
  food();
  fireEvent.click(await screen.findByRole('button', { name: /Log food/ }));
  const sheet = within(await screen.findByRole('dialog'));
  fireEvent.change(sheet.getByLabelText('Food'), { target: { value: 'id' } });
  fireEvent.click(await sheet.findByRole('button', { name: 'idli' }));
  expect((sheet.getByLabelText('Food') as HTMLInputElement).value).toBe('idli');
  fireEvent.change(sheet.getByLabelText('How many'), { target: { value: '3' } });
  expect(await sheet.findByText('175 kcal')).toBeTruthy(); // 3 × 40 g × 1.46
  fireEvent.click(sheet.getByRole('button', { name: 'Large' }));
  expect(await sheet.findByText('245 kcal')).toBeTruthy(); // 3 × 56 g × 1.46
  fireEvent.change(sheet.getByLabelText('Meal'), { target: { value: 'dinner' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === 'POST' && c.path === '/food/logs')?.body).toEqual({
      items: [{ name: 'idli', quantity: 3, unit: 'large piece', grams: null }],
      meal: 'dinner',
      day: DAY,
      source: 'manual',
    }),
  );
  expect(await screen.findByText('Food logged ✓')).toBeTruthy();
});

it('checks the manual form before saving, and grams need no portion size', async () => {
  const calls = mockApi({ 'GET /today': TODAY, 'GET /food/calories': CALORIES, 'POST /food/estimate': { found: false, name: null, grams: null, kcal: null, is_estimate: true } });
  food();
  fireEvent.click(await screen.findByRole('button', { name: /Log food/ }));
  const sheet = within(await screen.findByRole('dialog'));
  fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
  expect(sheet.getByText('Please enter what you ate.')).toBeTruthy();
  fireEvent.change(sheet.getByLabelText('Food'), { target: { value: 'mystery stew' } });
  fireEvent.change(sheet.getByLabelText('How many'), { target: { value: '0' } });
  fireEvent.click(sheet.getByRole('button', { name: 'Save' }));
  expect(sheet.getByText(/between 0.25 and 50/)).toBeTruthy();
  fireEvent.change(sheet.getByLabelText('How many'), { target: { value: '200' } });
  fireEvent.change(sheet.getByLabelText('Unit'), { target: { value: 'g' } });
  expect(sheet.queryByRole('group', { name: 'Portion size' })).toBeNull();
  fireEvent.change(sheet.getByLabelText('How many'), { target: { value: '2' } });
  expect(await sheet.findByText(/Not in the food list yet/)).toBeTruthy();
  expect(calls.some((c) => c.path === '/food/logs')).toBe(false);
});
