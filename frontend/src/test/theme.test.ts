// Text/background pairs meet WCAG AA (≥ 4.5:1) in both light and dark themes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/global.css', 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-alt'], ['text-muted', 'bg'], ['text-muted', 'surface'],
  ['on-primary', 'primary'], ['on-bubble-user', 'bubble-user'], ['on-bubble-bot', 'bubble-bot'], ['on-calm', 'calm'],
  ['on-chip', 'chip'], ['primary', 'bg'], ['primary', 'surface-alt'],
];

describe.each([
  ['light', ':root {'],
  ['dark', ":root[data-theme='dark']"],
])('%s theme', (_name, selector) => {
  const vars = block(selector);
  it.each(PAIRS)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
