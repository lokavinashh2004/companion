import { useEffect, useState } from 'react';

/** `value`, but only after it has stopped changing for `ms` (for search-as-you-type and live previews). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}
