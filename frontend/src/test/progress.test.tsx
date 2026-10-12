import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Me } from '@/routes/Me';
import { Progress } from '@/routes/Progress';
import { ME, mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token', signOut: async () => undefined }));

const days = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 8, 9 + i)).toISOString().slice(0, 10), score: 40 + i }));
const UP = {
  today: '2026-10-08',
  today_score: 39,
  week: { score: 72, previous: 58, change: 14, trend: 'up' },
  factors: [
    { key: 'meals', score: 81, previous: 60, trend: 'up' },
    { key: 'water', score: 70, previous: 72, trend: 'steady' },
    { key: 'steps', score: 40, previous: 55, trend: 'down' },
    { key: 'meds', score: 100, previous: null, trend: 'steady' },
  ],
  days,
  active_days: 26,
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows this week and the trend at the top of Me, linking to the full page', async () => {
  mockApi({ 'GET /me': ME, 'GET /overview': UP });
  renderPage(<Me />);
  const card = await screen.findByRole('link', { name: /Your progress: This week 72 out of 100, Going up/ });
  expect(card.getAttribute('href')).toBe('/me/progress');
  expect(within(card).getByText('Up 14 points')).toBeTruthy();
  expect(within(card).getByText('Last week: 58')).toBeTruthy();
});

it('the progress page shows the week, today so far, each habit and the last 30 days', async () => {
  mockApi({ 'GET /overview': UP });
  renderPage(<Progress />);
  expect(await screen.findByRole('img', { name: 'This week 72 out of 100' })).toBeTruthy();
  expect(screen.getByText(/more consistent than last week/)).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Today so far' }).getAttribute('aria-valuenow')).toBe('39');

  const habits = within(screen.getByRole('list'));
  const row = (name: string) => within(habits.getByText(name).closest('li')!);
  expect(row('Meals logged').getByText('Going up')).toBeTruthy();
  expect(row('Meals logged').getByText('Last week: 60%')).toBeTruthy();
  expect(row('Water').getByText('Steady')).toBeTruthy();
  expect(row('Steps').getByText('Going down')).toBeTruthy();
  expect(row('Medicines taken').queryByText(/Last week/)).toBeNull();

  expect(screen.getByRole('img', { name: 'Last 30 days' })).toBeTruthy();
  expect(screen.getByText('You logged something on 26 of the last 30 days.')).toBeTruthy();
  expect(screen.getByText(/a change of 5 points or more counts as up or down/)).toBeTruthy();
});

it('is gentle when the week went down', async () => {
  mockApi({ 'GET /overview': { ...UP, week: { score: 40, previous: 70, change: -30, trend: 'down' } } });
  renderPage(<Progress />);
  expect(await screen.findByText('Down 30 points')).toBeTruthy();
  expect(screen.getByText(/A little lower than last week, and that’s okay/)).toBeTruthy();
});
