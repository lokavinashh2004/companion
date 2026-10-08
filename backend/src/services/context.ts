// Shared dependencies for services, routes and jobs. Tests pass fakes for llm / embed / push / now.
import type { Env } from '../env.ts';
import type { Store } from '../store/index.ts';
import type { LlmClient } from './llm.ts';
import type { PushSender } from './push.ts';

export interface Services {
  store: Store;
  env: Pick<Env, 'USDA_API_KEY' | 'LLM_SUMMARY_RESERVE' | 'MED_ACTION_SECRET' | 'CRON_SECRET'>;
  llm: LlmClient;
  /** gte-small embedding; returns null when the model isn't available (memory search is then skipped). */
  embed(text: string): Promise<number[] | null>;
  push: PushSender;
  fetch: typeof fetch;
  now(): Date;
}
