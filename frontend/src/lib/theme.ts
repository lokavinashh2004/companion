import { create } from 'zustand';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'theme_pref'; // display preference only

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function apply(p: ThemePref) {
  if (p === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', p);
}

export const useTheme = create<{ pref: ThemePref; set: (p: ThemePref) => void }>((set) => {
  const pref = read();
  apply(pref);
  return {
    pref,
    set: (p) => {
      apply(p);
      try {
        localStorage.setItem(KEY, p);
      } catch {
        // ignore
      }
      set({ pref: p });
    },
  };
});
