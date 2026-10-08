// Sends 15 fixed messages (5 English, 5 Tamil script, 5 Tanglish) to every enabled model in llm_models
// and writes the outputs to eval/language-eval-<date>.md for manual review. Optionally applies caps.
//
//   OPENROUTER_API_KEY=... npm run models:eval            (reads backend/.env)
//   add -- --apply to write tamil_script / tanglish caps into src/store/seed/llm-models.json for models whose
//   automatic checks all pass (still review the report!). The backend syncs that file into the DB on startup.
//
// Costs 15 requests per model (150 for 10 models) — 3 days of a 50/day free budget, so run it rarely,
// or set MODELS=id1,id2 to evaluate a few at a time.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { companionSystemPrompt } from '../src/core/prompts/companion.ts';
import { checkReply, type ReplyLanguage } from '../src/core/language.ts';
import { CompanionResponse, extractJson } from '../src/core/schemas.ts';

const CASES: { lang: ReplyLanguage; text: string; expect: string }[] = [
  { lang: 'en', text: 'Had two idlis and sambar for breakfast', expect: 'foods idli x2, sambar; meal breakfast' },
  { lang: 'en', text: 'My period started today, cramps are bad', expect: 'period_event started 0; symptom cramps' },
  { lang: 'en', text: "Feeling really low and tired, didn't sleep well", expect: 'mood low; fatigue; sleep' },
  { lang: 'en', text: 'Period ended yesterday', expect: 'period_event ended -1' },
  { lang: 'en', text: 'Ate a plate of chicken biryani for lunch', expect: 'foods chicken biryani, plate, lunch' },
  { lang: 'ta', text: 'காலையில ரெண்டு தோசை சாப்பிட்டேன்', expect: 'foods dosai x2 breakfast; reply in Tamil script' },
  { lang: 'ta', text: 'இன்னைக்கு மாதவிடாய் ஆரம்பிச்சுது', expect: 'period_event started 0' },
  { lang: 'ta', text: 'ரொம்ப கவலையா இருக்கு, தூக்கமே வரல', expect: 'mood low/stress; sleep' },
  { lang: 'ta', text: 'மதியம் தயிர் சாதம், உருளைக்கிழங்கு பொரியல்', expect: 'foods curd rice, potato poriyal; lunch' },
  { lang: 'ta', text: 'பீரியட்ஸ் முடிஞ்சிடுச்சு', expect: 'period_event ended 0' },
  { lang: 'tanglish', text: 'kaalaila 2 dosai saapten', expect: 'foods dosai x2 breakfast; Tanglish reply' },
  { lang: 'tanglish', text: 'periods vandhuduchu, romba vali', expect: 'period_event started 0; cramps' },
  { lang: 'tanglish', text: 'innaiku romba stress ah iruku, exam friday', expect: 'stress high; fact exam Friday' },
  { lang: 'tanglish', text: 'lunch ku oru karandi sadam, sambar, beans poriyal', expect: 'foods sadam 1 karandi, sambar, beans poriyal' },
  { lang: 'tanglish', text: 'nethu periods mudinjiduchu', expect: 'period_event ended -1' },
];

const CONTEXT = 'Today: Wednesday, 7 Oct 2026.\nCycle: day 12 (follicular phase, rough estimate).\nFood logged today: nothing yet.';

async function main() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Set OPENROUTER_API_KEY (backend/.env)');
  const SEED = 'src/store/seed/llm-models.json';
  const seed = JSON.parse(readFileSync(SEED, 'utf8')) as { _about: string[]; models: { model_id: string; caps: string[]; enabled: boolean; supports_response_format: boolean }[] };
  const only = process.env.MODELS?.split(',').map((s: string) => s.trim());
  const list = seed.models.filter((m) => m.enabled && (!only || only.includes(m.model_id)));

  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# Language eval ${date}`, '', 'Review each reply: natural Tamil/Tanglish? correct extraction? persona kept?', ''];
  const passes: Record<string, { ta: number; tanglish: number }> = {};

  for (const m of list) {
    lines.push(`## ${m.model_id}`, '');
    passes[m.model_id] = { ta: 0, tanglish: 0 };
    for (const c of CASES) {
      const system = companionSystemPrompt({ companionName: 'Companion', personaTone: 'bestie', addressForm: 'casual', replyLanguage: c.lang, calorieDisplay: 'hide', contextBlock: CONTEXT });
      let verdict = '';
      let out = '';
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m.model_id,
            temperature: 0.7,
            messages: [{ role: 'system', content: system }, { role: 'user', content: c.text }],
            ...(m.supports_response_format ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(30000),
        });
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        out = body?.choices?.[0]?.message?.content ?? JSON.stringify(body).slice(0, 300);
        const parsed = CompanionResponse.safeParse(extractJson(out));
        if (!parsed.success) verdict = 'FAIL schema';
        else {
          const chk = checkReply(c.lang, parsed.data.reply);
          verdict = chk.ok ? 'auto-ok' : `FAIL ${chk.reason}`;
          if (chk.ok && c.lang === 'ta') passes[m.model_id]!.ta++;
          if (chk.ok && c.lang === 'tanglish') passes[m.model_id]!.tanglish++;
        }
      } catch (e) {
        verdict = `FAIL ${e instanceof Error ? e.message : e}`;
      }
      lines.push(`- **[${c.lang}]** ${c.text}  \n  expect: ${c.expect}  \n  verdict: ${verdict}  \n  \`\`\`\n${out.slice(0, 1200)}\n  \`\`\``);
      await new Promise((r) => setTimeout(r, 3500)); // stay under ~20 requests/minute
    }
    lines.push('');
  }

  lines.push('## Summary', '', '| model | Tamil script auto-ok (of 5) | Tanglish auto-ok (of 5) |', '|---|---|---|');
  for (const [id, p] of Object.entries(passes)) lines.push(`| ${id} | ${p.ta} | ${p.tanglish} |`);
  mkdirSync('eval', { recursive: true });
  const file = `eval/language-eval-${date}.md`;
  writeFileSync(file, lines.join('\n'));
  console.log(`wrote ${file}`);

  if (process.argv.includes('--apply')) {
    for (const m of list) {
      const p = passes[m.model_id]!;
      const caps = new Set<string>(m.caps.filter((c: string) => c !== 'tamil_script' && c !== 'tanglish'));
      if (p.ta === 5) caps.add('tamil_script');
      if (p.tanglish === 5) caps.add('tanglish');
      m.caps = [...caps];
      console.log(m.model_id, [...caps].join(','));
    }
    writeFileSync(SEED, `${JSON.stringify(seed, null, 1)}\n`);
    console.log(`updated ${SEED}; redeploy (or restart) the backend to sync it`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
