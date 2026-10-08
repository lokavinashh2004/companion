import { onIdTokenChanged } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { firebaseAuth, firebaseConfigured } from './firebase';

/** The signed-in person (from Firebase). */
export interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: !firebaseConfigured });
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onIdTokenChanged(firebaseAuth(), (u) => setState({ user: u ? { uid: u.uid, email: u.email } : null, ready: true }));
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
