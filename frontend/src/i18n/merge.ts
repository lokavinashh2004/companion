// Merges core locales with feature extras (locales/extra/<area>.en.json / <area>.ta.json).
import en from '../../locales/en.json';
import ta from '../../locales/ta.json';

export type Tree = { [k: string]: string | Tree };

export function deepMerge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    out[k] = typeof v === 'object' && v !== null && typeof cur === 'object' ? deepMerge(cur, v) : v;
  }
  return out;
}

/** `extras` maps file paths (…/<area>.<lang>.json) to their parsed JSON. */
export function mergeLocales(extras: Record<string, unknown>): { en: Tree; ta: Tree } {
  let outEn = en as Tree;
  let outTa = ta as Tree;
  for (const [path, json] of Object.entries(extras).sort(([a], [b]) => a.localeCompare(b))) {
    if (path.endsWith('.en.json')) outEn = deepMerge(outEn, json as Tree);
    else if (path.endsWith('.ta.json')) outTa = deepMerge(outTa, json as Tree);
  }
  return { en: outEn, ta: outTa };
}
