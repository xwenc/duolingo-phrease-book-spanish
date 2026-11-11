/** Average per-sentence evaluation scores; an empty round has no accuracy yet. */
export function getAverageAccuracy(scores: readonly number[]): number {
  if (!scores.length) return 0;
  const total = scores.reduce((sum, score) => sum + (Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0), 0);
  return Math.round(total / scores.length);
}
