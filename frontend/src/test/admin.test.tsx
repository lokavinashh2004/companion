// Admin AI-usage page: shows the numbers to the admin, a polite refusal to everyone else.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { loginEmail } from '@/lib/admin';
import { Admin } from '@/routes/Admin';
import { SignIn } from '@/routes/SignIn';
import { mockApi, renderPage } from './utils';

const fb = vi.hoisted(() => ({ firebaseConfigured: true, idToken: async () => 'token', signOut: vi.fn(async () => {}), signInEmail: vi.fn(async () => ({})), signUpEmail: vi.fn(), signInGoogle: vi.fn(), resetPassword: vi.fn(), firebaseAuth: () => ({}) }));
vi.mock('@/lib/firebase', () => fb);
const auth = vi.hoisted(() => ({ state: { user: { uid: 'u1', email: null } as { uid: string; email: string | null } | null, ready: true } }));
vi.mock('@/lib/auth', () => ({ useAuth: () => auth.state }));

const day = (i: number) => `2026-09-${String(26 + i).padStart(2, '0')}`.replace('2026-09-31', '2026-10-01');
const USAGE = {
  day: '2026-10-09',
  budget: 50,
  used: 18,
  remaining: 32,
  resets_at: '2026-10-10T00:00:00.000Z',
  tokens: { prompt: 21000, completion: 3400, total: 24400 },
  history: Array.from({ length: 14 }, (_, i) => ({ day: i < 5 ? day(i) : `2026-10-${String(i - 4).padStart(2, '0')}`, requests: i, prompt_tokens: i * 100, completion_tokens: i * 10 })),
  key: { status: 'ok', label: 'companion', free_tier: true, usage: 0, limit: null, limit_remaining: null, error: null },
  models: [
    { model_id: 'nvidia/nemotron-3-ultra-550b-a55b:free', priority: 1, enabled: true, health_disabled: false, cooling_until: null, success_count: 40, fail_count: 2, avg_latency_ms: 2100, last_error: null },
    { model_id: 'thinkingmachines/inkling:free', priority: 6, enabled: false, health_disabled: false, cooling_until: null, success_count: 0, fail_count: 3, avg_latency_ms: null, last_error: 'http_403: only available on agentic harnesses' },
  ],
};

beforeEach(async () => {
  vi.clearAllMocks();
  auth.state = { user: { uid: 'u1', email: null }, ready: true };
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows requests used and left, tokens, the key and each model', async () => {
  mockApi({ 'GET /admin/usage': USAGE });
  renderPage(<Admin />);
  expect(await screen.findByRole('meter', { name: 'Requests today' })).toBeTruthy();
  expect(screen.getByText(/32 left · resets at/)).toBeTruthy();
  expect(screen.getByText('24,400')).toBeTruthy();
  expect(screen.getByText('Working')).toBeTruthy();
  expect(screen.getByText('nvidia/nemotron-3-ultra-550b-a55b:free')).toBeTruthy();
  expect(screen.getByText('Off')).toBeTruthy();
  expect(screen.getByText('http_403: only available on agentic harnesses')).toBeTruthy();
});

it('tells non-admins the page is only for the owner', async () => {
  mockApi({ 'GET /admin/usage': { __status: 403, body: { error: 'forbidden' } } });
  renderPage(<Admin />);
  expect(await screen.findByText('Only for the app owner')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(fb.signOut).toHaveBeenCalled();
});

it('maps the username "admin" to the admin account and allows its 6-character password', async () => {
  expect(loginEmail(' Admin ')).toBe('admin@companion.app');
  expect(loginEmail('priya@example.com')).toBe('priya@example.com');
  auth.state = { user: null, ready: true };
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: '123456' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]!);
  await waitFor(() => expect(fb.signInEmail).toHaveBeenCalledWith('admin@companion.app', '123456'));
});
