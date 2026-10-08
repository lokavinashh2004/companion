// gte-small sentence embeddings (384 dims) running inside the backend with transformers.js (ONNX, CPU).
// The model is downloaded at build time (npm run prefetch-model) into MODEL_DIR, so a cold start on Render
// loads it from disk instead of the internet. Quantised (q8) to keep memory low on the free instance.
import { env as hf, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/gte-small';
export const EMBED_DIM = 384;

let extractor: Promise<FeatureExtractionPipeline> | null = null;

export function configureModelDir(dir: string, allowDownload: boolean): void {
  hf.cacheDir = dir;
  hf.allowRemoteModels = allowDownload;
}

function load(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  const fx = await load();
  const out = await fx(text.slice(0, 2000), { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

/** pgvector literal, e.g. '[0.1,0.2,…]' */
export const toVector = (v: number[]) => JSON.stringify(v);
