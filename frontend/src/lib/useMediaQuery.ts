import { useCallback, useSyncExternalStore } from 'react';

/** True while the CSS media query matches (false where matchMedia is unavailable, e.g. tests). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener?.('change', notify);
      return () => mq?.removeEventListener?.('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
