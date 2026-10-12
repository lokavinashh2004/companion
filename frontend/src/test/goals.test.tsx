import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Goals } from '@/routes/Goals';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const day = (n: number, percent: number, extra: Record<string, unknown> = {}) => ({
  day: `2026-10-${String(n).padStart(2, '0')}`,
  percent,
  complete: percent === 100,
  meals: percent === 100 ? 3 : 1,
  water_ml: percent === 100 ? 2000 : 750,
  steps: percent === 100 ? 5200 : 1200,
  ...extra,
});

const OCTOBER = {
  month: '2026-10',
  today: '2026-10-08',
  goals: { meals: 3, water_ml: 2000, steps: 5000 },
  days: [day(1, 33), day(2, 100), day(3, 0), day(4, 67), day(5, 100), day(6, 100), day(7, 100), day(8, 46, { meals: 2, water_ml: 500, steps: 2400 })],
  complete_days: 4,
  streak: 3,
};
const SEPTEMBER = { ...OCTOBER, month: '2026-09', days: [{ ...day(30, 100), day: '2026-09-30' }], complete_days: 1 };

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const render = () =>
  mockApi({ 'GET /progress': (_b: unknown, url: URL) => (url.searchParams.get('month') === '2026-09' ? SEPTEMBER : OCTOBER) });

it('shows each day as its progress, complete days, the streak and the rules', async () => {
  render();
  renderPage(<Goals />);
  expect(await screen.findByRole('button', { name: '2 October 2026: all goals done' })).toBeTruthy();
  const partial = screen.getByRole('button', { name: '4 October 2026: 67%' });
  expect(partial.getAttribute('style')).toContain('--p: 67%');
  // future days can't be picked
  expect((screen.getByRole('button', { name: '20 October 2026' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('4 of 8')).toBeTruthy();
  expect(screen.getByText(/3 days/)).toBeTruthy();
  expect(screen.getByText(/3 meals logged, 8 glasses of water and 5,000 steps/)).toBeTruthy();
});

it("shows today's breakdown, and another day's when tapped", async () => {
  render();
  renderPage(<Goals />);
  const today = await screen.findByRole('heading', { name: 'Thursday, 8 October' });
  const card = today.closest('section')!;
  expect(within(card).getByText('46%')).toBeTruthy();
  expect(within(card).getByText('2 of 3 meals')).toBeTruthy();
  expect(within(card).getByText('2 of 8 glasses')).toBeTruthy();
  expect(within(card).getByText('2,400 of 5,000')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '5 October 2026: all goals done' }));
  const picked = screen.getByRole('heading', { name: 'Monday, 5 October' }).closest('section')!;
  expect(within(picked).getByText('100%')).toBeTruthy();
  expect(within(picked).getByText(/All three goals done this day/)).toBeTruthy();
});

it('pages back to last month but not past this one', async () => {
  const calls = render();
  renderPage(<Goals />);
  await screen.findByRole('heading', { name: 'October 2026' });
  expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
  expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: '30 September 2026: all goals done' })).toBeTruthy();
  expect(calls.some((c) => c.url.searchParams.get('month') === '2026-09')).toBe(true);
});
