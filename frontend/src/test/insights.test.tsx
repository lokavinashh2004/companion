// Insights: weekly stats, pattern cards (no dismiss), charts with accessible titles, and Tamil.
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Insights } from '@/routes/Insights';
import ta from '../../locales/ta.json';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token', signOut: async () => {} }));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DATA = {
  insights: [
    { id: 'pattern:mood_by_phase', day: '2026-10-08', type: 'pattern', payload: { kind: 'mood_by_phase', lowest: 'luteal', averages: {} }, dismissed: false },
    { id: 'pattern:cravings_luteal', day: '2026-10-08', type: 'pattern', payload: { kind: 'cravings_luteal', lutealRate: 0.6, otherRate: 0.2 }, dismissed: false },
  ],
  cycle_lengths: [34, 41, 38],
  balance_trend: [
    { day: '2026-10-06', value: 6 },
    { day: '2026-10-07', value: 7.5 },
  ],
  mood_trend: [{ day: '2026-10-07', value: 3 }],
  weight_trend: null,
  week: { days_with_food_logged: 5, avg_balance_score: 6.8, avg_mood: null, avg_sleep_hours: 7.2, exercise_minutes_total: 90, medication_doses_taken: 12 },
};

it('renders weekly stats, pattern cards without dismiss, and charts', async () => {
  mockApi({ 'GET /insights': DATA });
  renderPage(<Insights />);
  expect(await screen.findByText('Days with food logged')).toBeTruthy();
  expect(screen.getByText('6.8')).toBeTruthy();
  expect(screen.queryByText('Average mood')).toBeNull(); // null stats are skipped

  expect(screen.getByText('You might notice…')).toBeTruthy();
  expect(screen.getByText('Your mood tends to dip a little in the Luteal phase (estimate).')).toBeTruthy();
  expect(screen.getByText('Cravings show up more in the days before your period.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();

  expect(screen.getByRole('img', { name: 'Cycle lengths' })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Food balance, last 14 days' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'Mood, last 30 days' })).toBeNull();
  expect(screen.getAllByText('Not enough data yet. Keep logging and this will fill in.')).toHaveLength(1);
  expect(screen.queryByText('Weight trend (smoothed)')).toBeNull();
  expect(screen.getByRole('link', { name: 'Open lab results' }).getAttribute('href')).toBe('/me/labs');
});

it('shows the weight trend only when tracking is on, and a dismissible weekly recap', async () => {
  mockApi({
    'GET /insights': {
      ...DATA,
      insights: [{ id: 'w1', day: '2026-10-05', type: 'weekly', payload: { message: 'A steady week, well done.' }, dismissed: false }],
      weight_trend: [
        { day: '2026-09-01', value: 70 },
        { day: '2026-09-08', value: 69.6 },
      ],
    },
  });
  renderPage(<Insights />);
  expect(await screen.findByRole('img', { name: 'Weight trend (smoothed)' })).toBeTruthy();
  expect(screen.getByText('A steady week, well done.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
});

it('renders in Tamil', async () => {
  mockApi({ 'GET /insights': DATA });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Insights />);
  expect(await screen.findByText(ta.insights.stats.days_with_food_logged)).toBeTruthy();
  expect(screen.getByText(ta.insightCards.patternTitle)).toBeTruthy();
  expect(screen.getByRole('img', { name: ta.insights.cycleLengths })).toBeTruthy();
  expect(screen.queryByText('Days with food logged')).toBeNull();
  expect(screen.queryByText('You might notice…')).toBeNull();
});
