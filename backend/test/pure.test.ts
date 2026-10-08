import { assert, assertEquals, assertThrows } from './assert.ts';
import { test } from 'vitest';
import { checkReply, detectScript, hasTamilScript, resolveReplyLanguage } from '../src/core/language.ts';
import { canonicalUnit, foldTanglish, normalizeFoodName, nutrientsFor, stripQuantityWords, toGrams, type FoodRow } from '../src/core/food.ts';
import { balanceScore } from '../src/core/score.ts';
import { matchesCrisis, scrubPII } from '../src/core/safety.ts';
import { CompanionResponse, extractJson, PhotoResponse } from '../src/core/schemas.ts';
import { addDays, diffDays, inQuietHours, todayIn } from '../src/core/dates.ts';

test('language detection', () => {
  assert(hasTamilScript('நான் இட்லி சாப்பிட்டேன்'));
  assert(!hasTamilScript('kaalaila 2 dosai saapten'));
  assertEquals(detectScript('நான் இட்லி சாப்பிட்டேன்'), 'ta');
  assertEquals(detectScript('kaalaila 2 dosai saapten'), 'tanglish');
  assertEquals(detectScript('I had two dosas for breakfast'), 'en');
  assertEquals(detectScript('today இட்லி saapten, feeling good, had coffee with friends'), 'mixed');
  assertEquals(resolveReplyLanguage('en', 'நான் இட்லி'), 'en');
  assertEquals(resolveReplyLanguage('auto', 'periods vandhuduchu'), 'tanglish');
});

test('reply checks', () => {
  assertEquals(checkReply('ta', 'Super da, nalla saaptiya!').ok, false);
  assertEquals(checkReply('ta', 'சூப்பர், நல்லா சாப்பிட்டியா!').ok, true);
  assertEquals(checkReply('tanglish', 'சூப்பர், நல்லா சாப்பிட்டியா!').ok, false);
  assertEquals(checkReply('en', 'As an AI language model, I cannot...').ok, false);
  assertEquals(checkReply('en', 'x'.repeat(1201)).ok, false);
  assertEquals(checkReply('en', 'नमस्ते').ok, false);
  assertEquals(checkReply('mixed', 'Nice! இட்லி is great').ok, true);
});

test('food normalisation and folding', () => {
  assertEquals(normalizeFoodName('  Dosai!! '), 'dosai');
  assertEquals(normalizeFoodName('இட்லி.'), 'இட்லி');
  const fold = (s: string) => foldTanglish(normalizeFoodName(s));
  assertEquals(fold('dosa'), fold('dosai'));
  assertEquals(fold('dosai'), fold('thosai'));
  assertEquals(fold('idli'), fold('idly'));
  assertEquals(fold('idli'), fold('itli'));
  assertEquals(fold('sadam'), fold('saadham'));
  assertEquals(fold('sadam'), fold('satham'));
  assertEquals(fold('kuzhambu'), fold('kulambu'));
  assertEquals(fold('chapathi'), fold('chapati'));
  assertEquals(fold('இட்லி'), 'இட்லி');
  assertEquals(stripQuantityWords('rendu dosai'), { name: 'dosai', quantity: 2 });
  assertEquals(stripQuantityWords('dosai'), { name: 'dosai', quantity: null });
  assertEquals(canonicalUnit('Ladles'), 'karandi');
  assertEquals(canonicalUnit(null), null);
});

const dosai: FoodRow = {
  id: 'f-dosai', canonical_name: 'dosai', kcal: 168, protein_g: 3.9, carbs_g: 29, fat_g: 3.7, fiber_g: 1.1,
  sugar_g: 0.5, added_sugar_g: 0, veg_fraction: 0, typical_serving_g: 80, gi_band: 'medium', is_liquid: false,
};
const rice: FoodRow = { ...dosai, id: 'f-rice', canonical_name: 'white rice', kcal: 130, typical_serving_g: 150, gi_band: 'high' };
const units = [
  { unit_name: 'piece', grams_or_ml: 80, applies_to: 'f-dosai' },
  { unit_name: 'karandi', grams_or_ml: 100, applies_to: null },
  { unit_name: 'cup', grams_or_ml: 150, applies_to: null },
];

test('unit conversion', () => {
  assertEquals(toGrams(2, null, dosai, units), 160);
  assertEquals(toGrams(2, 'piece', dosai, units), 160);
  assertEquals(toGrams(2, 'karandi', rice, units), 200);
  assertEquals(toGrams(150, 'g', rice, units), 150);
  assertEquals(toGrams(null, null, rice, units), 150);
  assertEquals(toGrams(1, 'bucket', rice, units), 150);
  assertEquals(nutrientsFor(dosai, 160).kcal, 269);
});

test('balance score', () => {
  assertEquals(balanceScore([]), null);
  const good = balanceScore([
    { kcal: 500, protein_g: 30, carbs_g: 50, fiber_g: 15, added_sugar_g: 0, veg_g: 200, gi_band: 'low' },
    { kcal: 300, protein_g: 15, carbs_g: 30, fiber_g: 12, added_sugar_g: 2, veg_g: 100, gi_band: 'low' },
  ])!;
  assertEquals(good.score, 10);
  assert(good.highlights.includes('protein'));
  const sweet = balanceScore([{ kcal: 600, protein_g: 5, carbs_g: 100, fiber_g: 1, added_sugar_g: 60, veg_g: 0, gi_band: 'high' }])!;
  assertEquals(sweet.score, 0);
  assertEquals(sweet.idea, 'add_protein');
});

test('crisis keywords EN / Tamil / Tanglish', () => {
  assert(matchesCrisis('I want to die'));
  assert(matchesCrisis('sometimes I think about suicide'));
  assert(matchesCrisis('enaku saaganum pola iruku'));
  assert(matchesCrisis('vaazha pidikala'));
  assert(matchesCrisis('எனக்கு சாகணும் போல இருக்கு'));
  assert(matchesCrisis('தற்கொலை பண்ணிக்கலாம்னு தோணுது'));
  assert(!matchesCrisis('I am dying to eat biryani'));
  assert(!matchesCrisis('periods vandhuduchu, romba vali'));
});

test('PII scrubber', () => {
  assertEquals(scrubPII('mail me at a.b@x.com'), 'mail me at [email]');
  assertEquals(scrubPII('call 98765 43210 now'), 'call [phone] now');
  assertEquals(scrubPII('+91-9876543210'), '[phone]');
  assertEquals(scrubPII('2 dosai and 1 coffee'), '2 dosai and 1 coffee');
});

test('extractJson strips fences', () => {
  assertEquals(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assertEquals(extractJson('Sure! {"a":{"b":2}} hope this helps'), { a: { b: 2 } });
  assertThrows(() => extractJson('no json'));
});

test('companion schema: full and minimal payloads', () => {
  const full = CompanionResponse.parse({
    reply: 'Super! Rendu dosai nalla breakfast.',
    language_detected: 'tanglish',
    extracted: {
      foods: [{ name: 'dosai', quantity: '2', unit: null, meal: 'breakfast' }, { name: '' }],
      period_event: { type: 'none', relative_day: 0, flow: null, pain: null },
      symptoms: [{ symptom: 'cramps', severity: 2 }, { symptom: 'unicorn', severity: 1 }],
      mood: { mood: 4, energy: null, stress: null },
      lifestyle: { sleep_hours: 7, water_ml: null, exercise_minutes: null, exercise_type: null, illness: null, travel: null },
      med_taken: [],
      new_facts: ['Has an exam on Friday'],
    },
    flags: { crisis: false, red_flag_symptom: false },
  });
  assertEquals(full.extracted.foods.length, 1);
  assertEquals(full.extracted.foods[0]!.quantity, 2);
  assertEquals(full.extracted.symptoms.length, 1);
  const minimal = CompanionResponse.parse({ reply: 'Hi!', language_detected: 'en' });
  assertEquals(minimal.extracted.foods, []);
  assertEquals(minimal.flags.crisis, false);
  assert(!CompanionResponse.safeParse({ language_detected: 'en' }).success);
  assert(!CompanionResponse.safeParse({ reply: '' }).success);
});

test('photo schema', () => {
  const p = PhotoResponse.parse({ items: [{ name: 'idli', quantity: 3, unit: 'piece' }, { name: 'sambar', quantity: 1, unit: 'bowl' }] });
  assertEquals(p.items.length, 2);
});

test('dates', () => {
  assertEquals(addDays('2026-12-30', 3), '2027-01-02');
  assertEquals(diffDays('2026-02-27', '2026-03-01'), 2);
  assertEquals(todayIn('Asia/Kolkata', new Date('2026-10-06T19:00:00Z')), '2026-10-07');
  assert(inQuietHours(23 * 60, '22:30', '07:30'));
  assert(inQuietHours(6 * 60, '22:30', '07:30'));
  assert(!inQuietHours(12 * 60, '22:30', '07:30'));
});

test('timezone offsets and local midnight', async () => {
  const { utcOffset, localMidnight, localDateTime } = await import('../src/core/dates.ts');
  assertEquals(utcOffset('Asia/Kolkata'), '+05:30');
  assertEquals(utcOffset('UTC'), '+00:00');
  assertEquals(utcOffset('America/New_York', new Date('2026-01-15T12:00:00Z')), '-05:00');
  assertEquals(localMidnight('2026-10-07', 'Asia/Kolkata'), '2026-10-07T00:00:00+05:30');
  assertEquals(localDateTime('2026-10-07', '08:30:00', 'Asia/Kolkata'), '2026-10-07T08:30:00+05:30');
});
