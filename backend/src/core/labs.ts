// "Within / outside the range on your report" — no other interpretation of lab values.

/** Parses ranges like "0.4 - 4.0", "0.4–4", "< 5", "> 30", "≤ 5.7". Returns null when unparseable. */
export function parseRange(range: string | null | undefined): { min: number | null; max: number | null } | null {
  if (!range) return null;
  const s = range.replace(/,/g, '.').replace(/[–—]/g, '-').trim();
  const between = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (between) return { min: Number(between[1]), max: Number(between[2]) };
  const lt = s.match(/^(?:<|≤|<=|up to|upto)\s*(\d+(?:\.\d+)?)/i);
  if (lt) return { min: null, max: Number(lt[1]) };
  const gt = s.match(/^(?:>|≥|>=)\s*(\d+(?:\.\d+)?)/i);
  if (gt) return { min: Number(gt[1]), max: null };
  return null;
}

export function withinRange(value: number, range: string | null | undefined): boolean | null {
  const r = parseRange(range);
  if (!r) return null;
  if (r.min !== null && value < r.min) return false;
  if (r.max !== null && value > r.max) return false;
  return true;
}
