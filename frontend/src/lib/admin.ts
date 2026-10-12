// The built-in admin account. Typing the username "admin" on the sign-in page signs in to this Firebase
// account (create it once in Firebase → Authentication → Users → Add user). The backend allows the same email.
export const ADMIN_USERNAME = 'admin';
export const ADMIN_EMAIL = 'admin@companion.app';

/** What she typed in the email box → the email Firebase should use. */
export function loginEmail(typed: string): string {
  const v = typed.trim();
  return v.toLowerCase() === ADMIN_USERNAME ? ADMIN_EMAIL : v;
}

export const isAdminEmail = (email: string | null | undefined) => (email ?? '').toLowerCase() === ADMIN_EMAIL;
