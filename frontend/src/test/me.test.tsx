// Me hub: links to every personal page, sign out, and Tamil UI.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { Me } from '@/routes/Me';
import { ME, mockApi, renderPage } from './utils';

const fb = vi.hoisted(() => ({ signOut: vi.fn(async () => {}) }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, ready: true }) }));
vi.mock('@/lib/firebase', () => ({ idToken: async () => 'token', signOut: fb.signOut }));

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows who is signed in, links to every Me page, and signs out', async () => {
  mockApi({ 'GET /me': { ...ME, profile: { ...ME.profile, companion_name: 'Nila' } } });
  renderPage(<Me />);
  expect(await screen.findByRole('heading', { name: 'Nila' })).toBeTruthy();
  expect(screen.getByText('Signed in as tester@companion.test')).toBeTruthy();

  const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
  expect(href(/What Nila remembers/)).toBe('/me/remembers');
  expect(href(/Insights/)).toBe('/insights');
  expect(href(/Medicines/)).toBe('/me/medications');
  expect(href(/Lab results/)).toBe('/me/labs');
  expect(href(/Settings/)).toBe('/me/settings');
  expect(screen.getByText('Companion supports you. It does not replace a doctor.')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(fb.signOut).toHaveBeenCalled();
});

it('renders in Tamil', async () => {
  mockApi({ 'GET /me': ME });
  await act(() => i18n.changeLanguage('ta'));
  renderPage(<Me />);
  expect(await screen.findByRole('link', { name: /அமைப்புகள்/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /மருந்துகள்/ })).toBeTruthy();
  expect(screen.queryByText('Sign out')).toBeNull();
  expect(screen.queryByText('Settings')).toBeNull();
});
