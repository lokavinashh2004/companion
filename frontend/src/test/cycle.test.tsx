import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { shortDate } from '@/lib/format';
import { Cycle } from '@/routes/Cycle';
import { mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

const TODAY = '2026-10-08';
const PERIOD = { id: 'p1', start_date: '2026-09-10', end_date: '2026-09-14', flow: 'medium', pain: 3, auto_closed: false, length_days: 5, cycle_length: null };
const OLDER = { id: 'p0', start_date: '2026-08-08', end_date: '2026-08-17', flow: 'light', pain: null, auto_closed: true, length_days: 10, cycle_length: 33 };
const CYCLE = {
  today: TODAY,
  status: { kind: 'cycle', cycle_day: 29, period_day: null, days_late: null, phase: 'luteal' },
  prediction: { earliest: '2026-10-05', likely: '2026-10-11', latest: '2026-10-18', confidence: 'medium', cycles_used: 3 },
  periods: [PERIOD, OLDER],
  insights: [{ id: 'i1', day: TODAY, type: 'delay', payload: { days_late: 3, factors: ['high_stress', 'poor_sleep'] }, dismissed: false }],
};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await act(() => i18n.changeLanguage('en'));
});

it('shows the predicted range (never a single date) and confidence', async () => {
  mockApi({ 'GET /cycle': CYCLE });
  renderPage(<Cycle />);
  expect(await screen.findByText(`${shortDate('2026-10-05')} – ${shortDate('2026-10-18')}`)).toBeTruthy();
  expect(screen.getByText('Medium confidence')).toBeTruthy();
  expect(screen.getByText('Based on 3 past cycles')).toBeTruthy();
  expect(screen.getByText('Cycle day 29')).toBeTruthy();
  expect(screen.queryByText(new RegExp(shortDate('2026-10-11')))).toBeNull();
  expect(screen.getByRole('button', { name: /^6 October 2026, predicted window$/ })).toBeTruthy();
  expect((screen.getByRole('button', { name: /^20 October 2026/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: /^8 October 2026/ }).getAttribute('aria-current')).toBe('date');
  expect(screen.getByText('Companion supports you. It does not replace a doctor.')).toBeTruthy();
});

it('tapping a calendar day logs a period start with flow and pain', async () => {
  const calls = mockApi({ 'GET /cycle': CYCLE, 'POST /cycle/periods': { ...PERIOD, id: 'p2', start_date: '2026-10-02', end_date: null } });
  renderPage(<Cycle />);
  fireEvent.click(await screen.findByRole('button', { name: '2 October 2026' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Heavy' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Pain (0–10) +' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Period started' }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === 'POST' && c.path === '/cycle/periods')?.body).toEqual({ kind: 'start', date: '2026-10-02', flow: 'heavy', pain: 1 }),
  );
  expect(await screen.findByText('Saved ✓')).toBeTruthy();
});

it('delay insight shows factors calmly and can be dismissed', async () => {
  const calls = mockApi({ 'GET /cycle': CYCLE, 'POST /insights/{id}/dismiss': { ok: true } });
  renderPage(<Cycle />);
  expect(await screen.findByText('Your period is running late')).toBeTruthy();
  expect(screen.getByText(/3 days past the predicted range/)).toBeTruthy();
  expect(screen.getByText('Quite a few stressful days')).toBeTruthy();
  expect(screen.getByText('Less sleep than usual')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/insights/i1/dismiss')).toBe(true));
});

it('auto-closed periods can be confirmed', async () => {
  const calls = mockApi({ 'GET /cycle': CYCLE, 'PATCH /cycle/periods/{id}': { ...OLDER, auto_closed: false } });
  renderPage(<Cycle />);
  expect(await screen.findByText(new RegExp(`Did it end on ${shortDate('2026-08-17')}`))).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ auto_closed: false }));
  expect(calls.find((c) => c.method === 'PATCH')?.path).toBe('/cycle/periods/p0');
});

it('history items open an edit sheet to set the end date or delete', async () => {
  const calls = mockApi({ 'GET /cycle': CYCLE, 'PATCH /cycle/periods/{id}': PERIOD, 'DELETE /cycle/periods/{id}': { ok: true } });
  renderPage(<Cycle />);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${shortDate('2026-09-10')} → ${shortDate('2026-09-14')}`) }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '7 days' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save end date' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ end_date: '2026-09-16' }));

  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${shortDate('2026-09-10')} →`) }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, delete' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/cycle/periods/p1')).toBe(true));
});

it('renders in Tamil', async () => {
  mockApi({ 'GET /cycle': CYCLE });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Cycle />);
  expect(await screen.findByText('நடுத்தர நம்பகத்தன்மை')).toBeTruthy();
  expect(screen.getByText('கடந்த 3 சுழற்சிகளின் அடிப்படையில்')).toBeTruthy();
  expect(screen.queryByText('Medium confidence')).toBeNull();
});
