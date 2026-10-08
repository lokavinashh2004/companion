import { expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';

import { mergeLocales } from '@/i18n/merge';

const extras = Object.fromEntries(
  readdirSync('locales/extra')
    .filter((f) => f.endsWith('.json'))
    .map((f) => [`locales/extra/${f}`, JSON.parse(readFileSync(`locales/extra/${f}`, 'utf8')) as unknown]),
);
const { en, ta } = mergeLocales(extras);

type Tree = { [k: string]: string | Tree };
const flat = (t: Tree, p = ''): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [[`${p}${k}`, v] as [string, string]] : flat(v, `${p}${k}.`)));

it('en and ta have the same keys', () => {
  expect(flat(ta as Tree).map(([k]) => k).sort()).toEqual(flat(en as Tree).map(([k]) => k).sort());
});

it('Tamil strings are in Tamil script (except names, units and placeholders)', () => {
  const allowed = new Set(['common.appName', 'onboarding.companionNamePlaceholder', 'onboarding.replyTanglish', 'settings.english', 'export.button', 'labs.names.AMH', 'labs.names.HbA1c']);
  const latinOnly = flat(ta as Tree).filter(
    ([k, v]) => !allowed.has(k) && /[a-z]{4,}/i.test(v.replace(/{{\w+}}/g, '').replace(/\bkcal\b/g, '')) && !/[\u0B80-\u0BFF]/.test(v),
  );
  expect(latinOnly.map(([k]) => k)).toEqual([]);
});
