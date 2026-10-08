// Remembers, Medicines and Labs: edit / delete facts, add / stop medicines, add labs and range badges.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Labs } from '@/routes/Labs';
import { Medications } from '@/routes/Medications';
import { Remembers } from '@/routes/Remembers';
import { ME, mockApi, renderPage } from './utils';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token', signOut: async () => {} }));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FACTS = {
  facts: [
    { id: 'f1', fact: 'Loves filter coffee', category: 'preference', updated_at: '2026-10-01T00:00:00Z' },
    { id: 'f2', fact: 'Sister Priya visits on Sunday', category: 'person', updated_at: '2026-10-01T00:00:00Z' },
  ],
};

it('Remembers: groups by category, edits via PATCH and deletes after confirm', async () => {
  const calls = mockApi({ 'GET /me': ME, 'GET /facts': FACTS, 'PATCH /facts/{id}': { ok: true }, 'DELETE /facts/{id}': { ok: true } });
  renderPage(<Remembers />);
  expect(await screen.findByText('Loves filter coffee')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Likes' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy();

  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
  const box = screen.getByLabelText('Edit this note');
  fireEvent.change(box, { target: { value: 'ok' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Use 3 to 300 characters.')).toBeTruthy();
  fireEvent.change(box, { target: { value: 'Loves filter coffee, no sugar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toBeTruthy());
  const patch = calls.find((c) => c.method === 'PATCH')!;
  expect(patch.path).toBe('/facts/f1');
  expect(patch.body).toEqual({ fact: 'Loves filter coffee, no sugar' });

  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Forget this?')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path.startsWith('/facts/'))).toBe(true));
});

it('Remembers: empty state', async () => {
  mockApi({ 'GET /me': ME, 'GET /facts': { facts: [] } });
  renderPage(<Remembers />);
  expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
});

const MEDS = {
  medications: [
    { id: 'm1', name: 'Metformin', dose: '500 mg', schedule_times: ['08:00:00', '20:00:00'], active: true, start_date: '2026-09-01', end_date: null },
    { id: 'm2', name: 'Inositol', dose: null, schedule_times: [], active: false, start_date: '2026-06-01', end_date: '2026-08-01' },
  ],
};

it('Medicines: lists active, adds with times, and stops with PATCH active:false', async () => {
  const calls = mockApi({ 'GET /meds': MEDS, 'POST /meds': { id: 'm3' }, 'PATCH /meds/{id}': { ok: true } });
  renderPage(<Medications />);
  expect(await screen.findByText('Metformin · 500 mg')).toBeTruthy();
  expect(screen.getByText('08:00, 20:00')).toBeTruthy();
  expect(screen.getByText('Stopped medicines (1)')).toBeTruthy();
  expect(screen.getByText(/only reminds you/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vitamin D' } });
  fireEvent.change(screen.getByLabelText('Dose'), { target: { value: '1000 IU' } });
  const time = screen.getByLabelText('New reminder time');
  fireEvent.change(time, { target: { value: '9:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
  expect(await screen.findByText('Use HH:MM, e.g. 08:30')).toBeTruthy();
  fireEvent.change(time, { target: { value: '21:30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
  fireEvent.change(time, { target: { value: '09:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
  expect(screen.getByRole('button', { name: 'Remove 09:00' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/meds')).toBeTruthy());
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ name: 'Vitamin D', dose: '1000 IU', schedule_times: ['09:00', '21:30'] });

  fireEvent.click(screen.getByRole('button', { name: 'Stop taking' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/stop date/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Stop taking' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toBeTruthy());
  const stop = calls.find((c) => c.method === 'PATCH')!;
  expect(stop.path).toBe('/meds/m1');
  expect(stop.body).toEqual({ active: false });
});

const LABS = {
  labs: [
    { id: 'l1', test_date: '2026-03-01', test_name: 'TSH', test_label: null, value: 5.1, unit: 'mIU/L', reference_range: '0.4 – 4.0', within_range: false },
    { id: 'l2', test_date: '2026-09-01', test_name: 'TSH', test_label: null, value: 3.2, unit: 'mIU/L', reference_range: '0.4 – 4.0', within_range: true },
    { id: 'l3', test_date: '2026-09-01', test_name: 'other', test_label: 'Prolactin', value: 12, unit: null, reference_range: null, within_range: null },
  ],
};

it('Labs: groups, charts, shows within/outside badges, adds and deletes', async () => {
  const calls = mockApi({ 'GET /me': ME, 'GET /labs': LABS, 'POST /labs': { id: 'l9' }, 'DELETE /labs/{id}': { ok: true } });
  renderPage(<Labs />);
  expect(await screen.findByRole('heading', { name: 'TSH' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Prolactin' })).toBeTruthy();
  expect(screen.getByText('Within the range on your report')).toBeTruthy();
  expect(screen.getByText('Outside the range on your report')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'TSH over time' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'Prolactin over time' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Add result' }));
  fireEvent.click(screen.getByRole('button', { name: 'Other' }));
  fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Enter a number.')).toBeTruthy();
  expect(screen.getByText('Add the test name.')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'AMH' }));
  fireEvent.change(screen.getByLabelText('Value'), { target: { value: '6.5' } });
  fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'ng/mL' } });
  fireEvent.change(screen.getByLabelText('Reference range (from your report)'), { target: { value: '1.0 – 4.0' } });
  fireEvent.change(screen.getByLabelText('Test date'), { target: { value: '2026-01-15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeTruthy());
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
    test_name: 'AMH',
    test_label: null,
    value: 6.5,
    unit: 'ng/mL',
    reference_range: '1.0 – 4.0',
    test_date: '2026-01-15',
  });

  fireEvent.click(screen.getAllByRole('button', { name: /^Delete · TSH/ })[0]!);
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path.startsWith('/labs/'))).toBe(true));
});

it('Labs and Medicines render in Tamil', async () => {
  mockApi({ 'GET /me': ME, 'GET /labs': LABS, 'GET /meds': MEDS });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Labs />);
  expect(await screen.findByText('உன் ரிப்போர்ட்டில் உள்ள வரம்புக்குள்')).toBeTruthy();
  expect(screen.queryByText('Within the range on your report')).toBeNull();
  cleanup();
  renderPage(<Medications />);
  expect(await screen.findByRole('button', { name: 'மருந்து சேர்' })).toBeTruthy();
});
