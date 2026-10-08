// 1. en and ta (core locales/*.json merged with locales/extra/<area>.<lang>.json) have exactly the same keys
//    and no empty values (except intentional ones).
// 2. Every static t('key') used in src/ exists in en.json.
// 3. No hard-coded English text between JSX tags in src/ (visible strings must go through i18n).
// Also regenerates TRANSLATION_REVIEW.md from ta.json + the server's pre-written messages.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FACTOR_PHRASES, SERVER_MESSAGES } from '../../backend/src/core/messages.ts';

type Tree = { [k: string]: string | Tree };
const problems0: string[] = [];
function deepMerge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    out[k] = typeof v === 'object' && typeof cur === 'object' ? deepMerge(cur, v) : v;
  }
  return out;
}
let en = JSON.parse(readFileSync('locales/en.json', 'utf8')) as Tree;
let ta = JSON.parse(readFileSync('locales/ta.json', 'utf8')) as Tree;
for (const f of readdirSync('locales/extra').filter((x) => x.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(join('locales/extra', f), 'utf8')) as Tree;
  if (f.endsWith('.en.json')) en = deepMerge(en, j);
  else if (f.endsWith('.ta.json')) ta = deepMerge(ta, j);
  else problems0.push(`locales/extra/${f}: name must end in .en.json or .ta.json`);
}
const ALLOWED_EMPTY = new Set(['cycle.phase.unknown']);

function flatten(t: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const fe = flatten(en);
const ft = flatten(ta);
const problems: string[] = [...problems0];
for (const k of fe.keys()) if (!ft.has(k)) problems.push(`ta.json missing ${k}`);
for (const k of ft.keys()) if (!fe.has(k)) problems.push(`en.json missing ${k}`);
for (const [k, v] of [...fe, ...ft]) if (!v.trim() && !ALLOWED_EMPTY.has(k)) problems.push(`empty value ${k}`);
for (const [k, v] of fe) {
  const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort().join(',');
  const tv = ft.get(k);
  if (tv !== undefined && vars(v) !== vars(tv)) problems.push(`placeholder mismatch ${k}: en {${vars(v)}} vs ta {${vars(tv)}}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

// Plural keys (x_one / x_other) are referenced as "x".
const baseKeys = new Set([...fe.keys()].map((k) => k.replace(/_(one|other)$/, '')));
for (const file of walk('src').filter((f) => !/[\\/]test[\\/]|\.test\.tsx?$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!baseKeys.has(m[1]!)) problems.push(`${file}: unknown key '${m[1]}'`);
  }
  if (file.endsWith('.tsx')) {
    // >Some words< inside JSX (letters, not just symbols/emoji/numbers)
    for (const m of src.matchAll(/>\s*([A-Za-z][A-Za-z ,.'!?-]{2,})\s*</g)) {
      problems.push(`${file}: hard-coded text "${m[1]!.trim()}"`);
    }
  }
}

// TRANSLATION_REVIEW.md
const lines = [
  '# Tamil translation review',
  '',
  'Tamil strings were written to be simple and natural, but they need a native speaker to check them.',
  'Tick each line once it reads right. Edit `frontend/locales/ta.json` (website) or `backend/src/core/messages.ts` (server messages), then run `npm run check:locales` in `frontend/` to regenerate this file.',
  '',
  '## Website strings (frontend/locales/ta.json)',
  '',
  '| ✓ | key | English | Tamil |',
  '|---|---|---|---|',
  ...[...fe].map(([k, v]) => `| [ ] | \`${k}\` | ${v.replace(/\|/g, '\\|')} | ${(ft.get(k) ?? '').replace(/\|/g, '\\|')} |`),
  '',
  '## Server messages (fallbacks, pushes, delay check-in)',
  '',
  '| ✓ | key | English | Tamil | Tanglish |',
  '|---|---|---|---|---|',
  ...Object.entries({ ...SERVER_MESSAGES, ...Object.fromEntries(Object.entries(FACTOR_PHRASES).map(([k, v]) => [`factor.${k}`, v])) }).map(
    ([k, v]) => `| [ ] | \`${k}\` | ${v.en} | ${v.ta} | ${v.tanglish} |`,
  ),
  '',
  'Also review the delay check-in template in `delayCheckIn()` in `backend/src/core/messages.ts`.',
  '',
];
writeFileSync('TRANSLATION_REVIEW.md', lines.join('\n'));

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} locale problem(s)`);
  process.exit(1);
}
console.log(`locales OK: ${fe.size} keys in both languages; TRANSLATION_REVIEW.md updated`);
