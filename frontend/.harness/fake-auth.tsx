import type { ReactNode } from 'react';
export const AuthProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
export const useAuth = () => ({ user: { uid: 'u1', email: 'priya@test' }, ready: true });
