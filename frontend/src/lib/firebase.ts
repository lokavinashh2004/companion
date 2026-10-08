// Firebase Authentication (email/password + Google). Firebase keeps its own session in the browser;
// we never store health data client-side.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = !!(config.apiKey && config.authDomain && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (!firebaseConfigured) throw new Error('firebase_not_configured');
  if (!auth) {
    app = initializeApp(config);
    auth = getAuth(app);
    void setPersistence(auth, browserLocalPersistence);
  }
  return auth;
}

export async function signInEmail(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(firebaseAuth(), email, password)).user;
}

export async function signUpEmail(email: string, password: string): Promise<User> {
  return (await createUserWithEmailAndPassword(firebaseAuth(), email, password)).user;
}

export async function signInGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(firebaseAuth(), provider);
  } catch (e) {
    // Some mobile browsers block pop-ups; fall back to a full-page redirect.
    if ((e as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(firebaseAuth(), provider);
    else throw e;
  }
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

export async function signOut(): Promise<void> {
  if (firebaseConfigured) await fbSignOut(firebaseAuth());
}

/** Fresh ID token for API calls (the SDK refreshes it automatically before expiry). */
export async function idToken(): Promise<string | null> {
  if (!firebaseConfigured) return null;
  const u = firebaseAuth().currentUser;
  return u ? u.getIdToken() : null;
}
