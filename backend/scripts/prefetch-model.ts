// Downloads gte-small into MODEL_DIR (run during the Render build) and reports memory use after one embedding.
//   npm run prefetch-model
import { configureModelDir, EMBED_DIM, embed } from '../src/services/embed.ts';

const dir = process.env.MODEL_DIR ?? './models';
configureModelDir(dir, true);

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
const before = process.memoryUsage().rss;
const t0 = Date.now();
const v = await embed('She has an exam on Friday and feels a little stressed.');
const v2 = await embed('Exam this Friday, worried about it');
const v3 = await embed('Had idli and sambar for breakfast');
const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

if (v.length !== EMBED_DIM) throw new Error(`expected ${EMBED_DIM} dims, got ${v.length}`);
console.log(`model cached in ${dir}`);
console.log(`dims ${v.length}, first load + 3 embeddings ${Date.now() - t0} ms`);
console.log(`similar sentences ${cos(v, v2).toFixed(3)} vs unrelated ${cos(v, v3).toFixed(3)}`);
console.log(`RSS before ${mb(before)}, after ${mb(process.memoryUsage().rss)}`);
