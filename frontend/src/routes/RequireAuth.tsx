// Gates for signed-in pages: sends visitors to /sign-in, and new users to /onboarding first.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/queries';

export function RequireAuth({ children, allowUnboarded = false }: { children: ReactNode; allowUnboarded?: boolean }) {
  const { user, ready } = useAuth();
  const me = useMe();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (me.isLoading) return <Loading />;
  if (!allowUnboarded && me.data && !me.data.profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
