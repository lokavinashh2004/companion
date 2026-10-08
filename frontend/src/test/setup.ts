import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import '../i18n';

// findBy*/waitFor default to 1 s, which is too tight when the whole suite runs in parallel on a slow machine.
configure({ asyncUtilTimeout: 5000 });

// Vitest globals are off, so Testing Library can't register its own cleanup: unmount after every test.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
