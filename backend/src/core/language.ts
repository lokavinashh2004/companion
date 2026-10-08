// Language detection and reply-language rules. Code detects Tamil script by Unicode range;
// the model reports Tanglish vs English via language_detected.

export type DisplayLanguage = 'auto' | 'en' | 'ta' | 'tanglish';
export type ReplyLanguage = 'en' | 'ta' | 'tanglish' | 'mixed';

const TAMIL_RE = /[஀-௿]/;
const TAMIL_RE_G = /[஀-௿]/g;
const LETTER_RE_G = /[\p{L}]/gu;

export function hasTamilScript(text: string): boolean {
  return TAMIL_RE.test(text);
}

/** Share of letters that are Tamil script (0..1). */
export function tamilRatio(text: string): number {
  const letters = text.match(LETTER_RE_G)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(TAMIL_RE_G)?.length ?? 0) / letters;
}

// Common Tanglish words. Used only as a hint when the model has not told us yet.
const TANGLISH_HINTS = [
  'naan', 'nan', 'enaku', 'enakku', 'saapten', 'saptten', 'sapten', 'saapadu', 'sapadu', 'romba', 'konjam',
  'iruku', 'irukku', 'illa', 'illai', 'vandhuduchu', 'vanthuduchu', 'mudinjiduchu', 'mudinjuduchu', 'pannen',
  'panren', 'poitu', 'vandhen', 'seri', 'sari', 'enna', 'epdi', 'eppadi', 'kaalaila', 'kalaila', 'madhiyam',
  'raathiri', 'rathiri', 'nalla', 'kashtama', 'kastama', 'thookam', 'thookkam', 'vali', 'vayiru', 'da', 'di',
  'pa', 'ma', 'aachu', 'achu', 'oru', 'rendu', 'moonu', 'karandi', 'sadam', 'saadham', 'kuzhambu', 'kulambu',
];

export function looksTanglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length === 0) return false;
  const hits = words.filter((w) => TANGLISH_HINTS.includes(w)).length;
  return hits >= 1 && hits / words.length >= 0.15;
}

/** Script-level detection for one message. Tanglish is a hint; the model's report wins later. */
export function detectScript(text: string): ReplyLanguage {
  const r = tamilRatio(text);
  if (r >= 0.6) return 'ta';
  if (r > 0) return 'mixed';
  return looksTanglish(text) ? 'tanglish' : 'en';
}

/** The language the companion should reply in for this message. */
export function resolveReplyLanguage(setting: DisplayLanguage, messageText: string): ReplyLanguage {
  if (setting !== 'auto') return setting;
  return detectScript(messageText);
}

const PERSONA_BREAKS = [
  /as an ai/i,
  /as a language model/i,
  /i am an ai/i,
  /i'm an ai/i,
  /i am a large language model/i,
  /i cannot provide medical/i,
  /openai|anthropic|google gemini|meta llama/i,
];

export const MAX_REPLY_CHARS = 1200;

export type ReplyCheck = { ok: true } | { ok: false; reason: string };

/** Router acceptance check on the reply text. */
export function checkReply(expected: ReplyLanguage, reply: string): ReplyCheck {
  const text = reply.trim();
  if (!text) return { ok: false, reason: 'empty_reply' };
  if (text.length > MAX_REPLY_CHARS) return { ok: false, reason: 'too_long' };
  if (PERSONA_BREAKS.some((re) => re.test(text))) return { ok: false, reason: 'persona_break' };
  const ratio = tamilRatio(text);
  if (expected === 'ta' && ratio === 0) return { ok: false, reason: 'wrong_language' };
  if ((expected === 'en' || expected === 'tanglish') && ratio > 0.5) {
    return { ok: false, reason: 'wrong_language' };
  }
  // Other Indic scripts (Devanagari, Malayalam, Telugu, Kannada) are always wrong.
  if (/[ऀ-ॿഀ-ൿఀ-౿ಀ-೿]/.test(text)) {
    return { ok: false, reason: 'wrong_language' };
  }
  return { ok: true };
}
