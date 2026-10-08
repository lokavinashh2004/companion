// Switching the language changes every visible string on the sign-in page.
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';

import i18n from '@/i18n';
import { AuthProvider } from '@/lib/auth';
import { SignIn } from '@/routes/SignIn';
import en from '../../locales/en.json';

it('renders English, then Tamil with no English UI strings left', async () => {
  await act(() => i18n.changeLanguage('en'));
  render(
    <MemoryRouter>
      <AuthProvider>
        <SignIn />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: en.auth.title })).toBeTruthy();
  expect(screen.getByRole('button', { name: en.auth.google })).toBeTruthy();

  await act(() => i18n.changeLanguage('ta'));
  for (const s of [en.auth.title, en.auth.subtitle, en.auth.google, en.auth.signIn, en.common.disclaimer]) {
    expect(screen.queryByText(s)).toBeNull();
  }
  expect(screen.getByRole('heading', { name: 'வணக்கம்' })).toBeTruthy();
  expect(document.documentElement.lang).toBe('ta');
});
