// Crisis keyword match (EN / Tamil / Tanglish) and the privacy scrubber.
// The keyword list is a safety net next to the model's flags.crisis; either one shows the support card.

const CRISIS_PATTERNS: RegExp[] = [
  // English
  /\bkill(ing)? my ?self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bwant(ed)? to die\b/i,
  /\bwanna die\b/i,
  /\bend (it all|my life)\b/i,
  /\bself[- ]?harm\b/i,
  /\bcut(ting)? my ?self\b/i,
  /\bhurt(ing)? my ?self\b/i,
  /\bno reason to live\b/i,
  /\bbetter off dead\b/i,
  /\bdon'?t want to (live|be alive)\b/i,
  // Tanglish
  /\bsaaga(num|num pola|poren|poghiren|pogiren)\b/i,
  /\bsethu(dalam|duven|poganum|pogonum)\b/i,
  /\bsethudalaam\b/i,
  /\bsaavalaam\b/i,
  /\bsavanum\b/i,
  /\bsaganum\b/i,
  /\bthatkolai\b/i,
  /\buyir(a|ai)? (vida|vidanum|vidalam)\b/i,
  /\bvaazha (pidikala|pudikala|venam|vendam)\b/i,
  /\bvazha (pidikala|pudikala|venam|vendam)\b/i,
  /\bmudichikalaam\b/i,
  // Tamil script
  /சாகணும்/,
  /சாகப்போறேன்/,
  /சாக போறேன்/,
  /செத்துடலாம்/,
  /செத்துப்போகணும்/,
  /தற்கொலை/,
  /உயிரை விட/,
  /வாழ பிடிக்கல/,
  /வாழப் பிடிக்கவில்லை/,
  /என்னை நானே காயப்படுத்த/,
];

export function matchesCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Phone-like runs: optional +country, 10+ digits with spaces/dashes.
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,13}\d/g;

/** Removes emails and phone numbers before any text is sent to an LLM. */
export function scrubPII(text: string): string {
  return text.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

export const TELE_MANAS = '14416';
