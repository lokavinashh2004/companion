// Firebase sign-in failures show a message she (or the app owner) can act on.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { SignIn } from '@/routes/SignIn';
import shell from '../../locales/extra/shell.en.json';

const fb = vi.hoisted(() => ({
  firebaseConfigured: true,
  signInGoogle: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  resetPassword: vi.fn(async () => {}),
  signOut: vi.fn(),
  idToken: async () => null,
  firebaseAuth: () => ({}),
}));
vi.mock('@/lib/firebase', () => fb);
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null, ready: true }) }));

const fail = (code: string) => Object.assign(new Error(code), { code });

beforeEach(async () => {
  vi.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

const page = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );

it('explains an unauthorized domain on Google sign-in, and stays quiet when she closes the pop-up', async () => {
  fb.signInGoogle.mockRejectedValueOnce(fail('auth/unauthorized-domain'));
  page();
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(await screen.findByText(shell.authErrors.unauthorizedDomain)).toBeTruthy();

  fb.signInGoogle.mockRejectedValueOnce(fail('auth/popup-closed-by-user'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await act(async () => {});
  expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
});

it('says when the email and password do not match', async () => {
  fb.signInEmail.mockRejectedValueOnce(fail('auth/invalid-credential'));
  page();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]!);
  expect(await screen.findByText(shell.authErrors.wrongLogin)).toBeTruthy();
});
