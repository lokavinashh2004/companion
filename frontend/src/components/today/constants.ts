import type { QuickLog } from '@/lib/api';

export const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'] as const;

export type Symptom = NonNullable<QuickLog['symptoms']>[number];
export const QUICK_SYMPTOMS: Symptom[] = ['acne', 'hair_fall', 'hirsutism', 'bloating', 'cramps', 'cravings', 'fatigue', 'headache', 'pelvic_pain', 'breast_tenderness', 'spotting'];
