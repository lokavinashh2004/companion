import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: r('.'),
  envDir: r('..'),
  resolve: {
    alias: [
      { find: /^(@\/lib|\.)\/auth$/, replacement: r('./fake-auth.tsx') },
      { find: /^(@\/lib|\.)\/firebase$/, replacement: r('./fake-firebase.ts') },
      { find: '@', replacement: r('../src') },
    ],
  },
  plugins: [react()],
  server: { port: 5174, strictPort: true, fs: { allow: [r('..')] } },
});
