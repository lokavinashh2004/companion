// Only the Latin + Tamil subsets we need (keeps the offline cache small).
import '@fontsource-variable/anek-tamil/standard.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans-tamil/tamil-400.css';
import '@fontsource/noto-sans-tamil/tamil-600.css';
import '@fontsource/noto-sans-tamil/tamil-700.css';
import './styles/global.css';
import './i18n';
import './lib/theme';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { registerSW } from 'virtual:pwa-register';

import { AuthProvider } from './lib/auth';
import { Chat } from './routes/Chat';
import { Cycle } from './routes/Cycle';
import { Insights } from './routes/Insights';
import { Labs } from './routes/Labs';
import { Layout } from './routes/Layout';
import { Me } from './routes/Me';
import { Medications } from './routes/Medications';
import { NotFound } from './routes/NotFound';
import { Onboarding } from './routes/Onboarding';
import { Remembers } from './routes/Remembers';
import { RequireAuth } from './routes/RequireAuth';
import { Settings } from './routes/Settings';
import { SignIn } from './routes/SignIn';
import { Today } from './routes/Today';

// Cache lives in memory only (no health data persisted in the browser).
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth allowUnboarded>
        <Onboarding />
      </RequireAuth>
    ),
  },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Chat /> },
      { path: '/today', element: <Today /> },
      { path: '/cycle', element: <Cycle /> },
      { path: '/insights', element: <Insights /> },
      { path: '/me', element: <Me /> },
      { path: '/me/settings', element: <Settings /> },
      { path: '/me/remembers', element: <Remembers /> },
      { path: '/me/medications', element: <Medications /> },
      { path: '/me/labs', element: <Labs /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

if ('serviceWorker' in navigator) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
