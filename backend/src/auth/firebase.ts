// Firebase Admin: verifies the ID token the frontend sends, and deletes users ("Delete everything").
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import type { Env } from '../env.ts';

export interface VerifiedUser {
  uid: string;
  email: string | null;
}

export interface FirebaseAuth {
  verifyToken(idToken: string): Promise<VerifiedUser>;
  deleteUser(uid: string): Promise<void>;
}

function parseServiceAccount(raw: string): Record<string, string> {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text) as Record<string, string>;
}

export function createFirebaseAuth(env: Pick<Env, 'FIREBASE_PROJECT_ID' | 'FIREBASE_SERVICE_ACCOUNT'>): FirebaseAuth {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required');
  const app: App =
    getApps()[0] ??
    initializeApp(
      env.FIREBASE_SERVICE_ACCOUNT
        ? { credential: cert(parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)), projectId: env.FIREBASE_PROJECT_ID }
        : { projectId: env.FIREBASE_PROJECT_ID },
    );
  const auth = getAuth(app);
  return {
    async verifyToken(idToken) {
      // Checks signature (Google's public keys), expiry, issuer and audience = our project.
      const decoded = await auth.verifyIdToken(idToken, false);
      return { uid: decoded.uid, email: decoded.email ?? null };
    },
    async deleteUser(uid) {
      if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is required to delete users');
      await auth.deleteUser(uid);
    },
  };
}
