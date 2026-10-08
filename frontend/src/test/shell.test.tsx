import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useApiStatus } from '@/lib/api';
import { Layout } from '@/routes/Layout';
import { ME, mockApi } from './utils';

const authState = vi.hoisted(() => ({ user: null as unknown, ready: true }));
vi.mock('@/lib/auth', () => ({ useAuth: () => authState }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token' }));

afterEach(() => {
  useApiStatus.setState({ waking: false });
  vi.unstubAllGlobals();
});

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sign-in" element={<p>sign-in page</p>} />
          <Route path="/onboarding" element={<p>onboarding page</p>} />
          <Route element={<Layout />}>
            <Route path="/" element={<p>chat page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it('signed-out visitors are sent to sign-in', () => {
  authState.user = null;
  renderAt('/');
  expect(screen.getByText('sign-in page')).toBeTruthy();
});

it('new users are sent to onboarding first', async () => {
  authState.user = { uid: 'u1' };
  mockApi({ 'GET /me': { ...ME, profile: { ...ME.profile, onboarding_done: false } } });
  renderAt('/');
  expect(await screen.findByText('onboarding page')).toBeTruthy();
});

it('signed-in shell shows the tabs and a waking-up notice for slow API calls', async () => {
  authState.user = { uid: 'u1' };
  mockApi({ 'GET /me': ME });
  await act(() => i18n.changeLanguage('en'));
  renderAt('/');
  expect(await screen.findByText('chat page')).toBeTruthy();
  for (const name of ['Chat', 'Today', 'Cycle', 'Me']) expect(screen.getByRole('link', { name: new RegExp(name) })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Chat/ }).getAttribute('aria-current')).toBe('page');
  act(() => useApiStatus.setState({ waking: true }));
  expect(screen.getByText(/Waking up the server/)).toBeTruthy();
});
