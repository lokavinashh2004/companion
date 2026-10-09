import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    // The PWA plugin isn't needed (and stalls) under Vitest; tests mock push and the service worker.
    !process.env.VITEST && VitePWA({
      // Our own service worker (src/sw.ts): offline app shell now, Web Push + medicine actions in W1.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Companion',
        short_name: 'Companion',
        description: 'Your private PCOS companion',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF0FB',
        theme_color: '#5B2FD6',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      // Also run the service worker under `npm run dev`, so notifications can be tried locally.
      devOptions: { enabled: !process.env.VITEST, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  test: {
    environment: 'jsdom',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
