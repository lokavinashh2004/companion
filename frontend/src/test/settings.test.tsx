// Settings: saves via PATCH /me, validates times, and drives Web Push.
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Settings } from '@/routes/Settings';
import { ME, mockApi, PROFILE, renderPage } from './utils';

const push = vi.hoisted(() => {
  const p = {
    state: 'off' as string,
    pushState: async () => p.state,
    enablePush: vi.fn(async () => 'on'),
    disablePush: vi.fn(async () => 'off'),
    sendTestPush: vi.fn(async () => 'sent'),
    isIos: () => false,
    isStandalone: () => false,
  };
  return p;
});
vi.mock('@/lib/push', () => push);
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token', signOut: async () => {} }));

const patchMe = () => mockApi({ 'GET /me': ME, 'PATCH /me': (body: unknown) => ({ ...PROFILE, ...(body as object) }) });

beforeEach(async () => {
  push.state = 'off';
  vi.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('changing the reply language PATCHes /me and shows Saved', async () => {
  const calls = patchMe();
  renderPage(<Settings />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tanglish' }));
  expect(await screen.findByText('Saved ✓')).toBeTruthy();
  const patch = calls.find((c) => c.method === 'PATCH' && c.path === '/me');
  expect(patch?.body).toEqual({ display_language: 'tanglish' });
});

it('blocks bad HH:MM times and saves valid ones together', async () => {
  const calls = patchMe();
  renderPage(<Settings />);
  const morning = await screen.findByLabelText('Morning');
  fireEvent.change(morning, { target: { value: '25:99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save times' }));
  expect(await screen.findByText('Use HH:MM, e.g. 08:30')).toBeTruthy();
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

  fireEvent.change(morning, { target: { value: '07:15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save times' }));
  await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
  expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ morning_checkin: '07:15', evening_checkin: '21:00', quiet_start: '22:30', quiet_end: '07:30' });
});

it('push off → Turn on calls enablePush, then offers a test', async () => {
  patchMe();
  renderPage(<Settings />);
  fireEvent.click(await screen.findByRole('button', { name: 'Turn on' }));
  await waitFor(() => expect(push.enablePush).toHaveBeenCalled());
  fireEvent.click(await screen.findByRole('button', { name: 'Send a test' }));
  expect(await screen.findByText('Test sent. It should appear in a moment.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Turn off' })).toBeTruthy();
});

it('explains iPhone install steps when needed', async () => {
  push.state = 'needs-install';
  patchMe();
  renderPage(<Settings />);
  expect(await screen.findByText('Choose “Add to Home Screen”.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Turn on' })).toBeNull();
});

it('renders in Tamil', async () => {
  patchMe();
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Settings />);
  expect(await screen.findByRole('heading', { name: 'அறிவிப்புகள்' })).toBeTruthy();
  expect(screen.queryByText('Notifications')).toBeNull();
});
