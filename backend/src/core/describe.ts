// English sentence describing her cycle for the LLM context (the model must use these values exactly).
import type { CycleStatus, Prediction } from './cycle.ts';

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function describeCycleStatus(s: CycleStatus, prediction: Prediction | null): string {
  const window = prediction
    ? `Next period predicted between ${fmt(prediction.earliest)} and ${fmt(prediction.latest)} (most likely around ${fmt(prediction.likely)}, confidence ${prediction.confidence}; PCOS cycles often vary, so this is a range).`
    : 'No period logged yet, so no prediction.';
  switch (s.kind) {
    case 'none':
      return `Cycle: unknown. ${window}`;
    case 'period':
      return `Cycle: period currently ongoing (day ${s.periodDay}). ${window}`;
    case 'late':
      return `Cycle: day ${s.cycleDay}; period late by ${s.daysLate} days compared with the predicted range. ${window}`;
    case 'cycle':
      return `Cycle: day ${s.cycleDay}${s.phase !== 'unknown' ? ` (${s.phase} phase, rough estimate)` : ''}. ${window}`;
  }
}
