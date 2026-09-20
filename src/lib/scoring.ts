import type { Review } from "./types";

/**
 * Weighted 0-100 composite, landing in the same range people already read
 * from magazine scores (high 80s = good, 90+ = excellent).
 *
 * `value` is deliberately excluded. Price is a property of a purchase, not of
 * the blend, so folding it into the blend's score would make the same cigar
 * rate differently depending on where you bought it. It is tracked separately
 * and used for the rating-per-dollar analysis instead.
 */
export const SCORE_WEIGHTS = {
  appearance: 0.1,
  construction: 0.15,
  draw: 0.15,
  burn: 0.1,
  flavor: 0.3,
  complexity: 0.2,
} as const;

export type ScoreKey = keyof typeof SCORE_WEIGHTS;

export const SCORE_LABELS: Record<ScoreKey, string> = {
  appearance: "Appearance",
  construction: "Construction",
  draw: "Draw",
  burn: "Burn & Ash",
  flavor: "Flavor",
  complexity: "Complexity",
};

export const SCORE_HINTS: Record<ScoreKey, string> = {
  appearance: "Wrapper sheen, veins, seams, cap",
  construction: "Firmness, no soft spots, weight",
  draw: "Resistance - not plugged, not airy",
  burn: "Burn line, ash hold, touch-ups needed",
  flavor: "How good does it actually taste",
  complexity: "Does it evolve, or stay flat",
};

export type SubScores = Pick<Review, ScoreKey>;

export function computeOverall(scores: SubScores): number {
  const total = (Object.keys(SCORE_WEIGHTS) as ScoreKey[]).reduce(
    (sum, key) => sum + clamp10(scores[key]) * SCORE_WEIGHTS[key],
    0,
  );
  // 0-10 weighted mean -> 0-100, rounded to a whole point.
  return Math.round(total * 10);
}

function clamp10(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, n));
}

export function scoreBand(overall: number): {
  label: string;
  tone: "great" | "good" | "ok" | "poor";
} {
  if (overall >= 93) return { label: "Outstanding", tone: "great" };
  if (overall >= 88) return { label: "Excellent", tone: "great" };
  if (overall >= 83) return { label: "Very good", tone: "good" };
  if (overall >= 75) return { label: "Good", tone: "ok" };
  if (overall >= 65) return { label: "Average", tone: "ok" };
  return { label: "Below average", tone: "poor" };
}
