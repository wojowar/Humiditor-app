import { daysSince, MS_PER_DAY } from "./rest";
import type {
  CigarProduct,
  InventoryItem,
  Review,
  SmokeSession,
} from "./types";

export interface CollectionStats {
  totalSticks: number;
  distinctProducts: number;
  collectionValue: number;
  restingSticks: number;
  readySticks: number;
  avgCostPerStick: number;
}

export function collectionStats(
  inventory: InventoryItem[],
  now = Date.now(),
): CollectionStats {
  const live = inventory.filter((i) => i.qty > 0);
  const totalSticks = live.reduce((s, i) => s + i.qty, 0);
  const collectionValue = live.reduce(
    (s, i) => s + i.qty * (i.pricePerStick ?? 0),
    0,
  );
  const priced = live.filter((i) => i.pricePerStick != null);
  const pricedSticks = priced.reduce((s, i) => s + i.qty, 0);

  let restingSticks = 0;
  let readySticks = 0;
  for (const item of live) {
    const age = daysSince(item.acquiredOn, now);
    if (age < (item.restDays ?? 0)) restingSticks += item.qty;
    else readySticks += item.qty;
  }

  return {
    totalSticks,
    distinctProducts: new Set(live.map((i) => i.productId)).size,
    collectionValue,
    restingSticks,
    readySticks,
    avgCostPerStick: pricedSticks
      ? priced.reduce((s, i) => s + i.qty * (i.pricePerStick ?? 0), 0) /
        pricedSticks
      : 0,
  };
}

export interface BurnRate {
  perWeek: number;
  windowDays: number;
  weeksOfStockLeft: number | null;
}

/**
 * How fast you actually smoke, measured over a trailing window so a heavy
 * month last year doesn't skew the restock math.
 */
export function burnRate(
  sessions: SmokeSession[],
  sticksOnHand: number,
  windowDays = 90,
  now = Date.now(),
): BurnRate {
  const cutoff = now - windowDays * MS_PER_DAY;
  const recent = sessions.filter((s) => Date.parse(s.smokedAt) >= cutoff);
  if (recent.length === 0) {
    return { perWeek: 0, windowDays, weeksOfStockLeft: null };
  }
  // Measure from the first smoke in the window, so a new user with two weeks
  // of history isn't averaged across a full 90 days and told they never smoke.
  const earliest = Math.min(...recent.map((s) => Date.parse(s.smokedAt)));
  const spanDays = Math.max(7, (now - earliest) / MS_PER_DAY);
  const perWeek = (recent.length / spanDays) * 7;
  return {
    perWeek,
    windowDays,
    weeksOfStockLeft: perWeek > 0 ? sticksOnHand / perWeek : null,
  };
}

export interface ProductRating {
  product: CigarProduct;
  reviewCount: number;
  avgOverall: number;
  bestOverall: number;
  lastSmokedAt?: string;
}

export function productRatings(
  products: CigarProduct[],
  reviews: Review[],
  sessions: SmokeSession[],
): ProductRating[] {
  const byProduct = new Map<string, Review[]>();
  for (const r of reviews) {
    const list = byProduct.get(r.productId) ?? [];
    list.push(r);
    byProduct.set(r.productId, list);
  }
  const lastSmoked = new Map<string, string>();
  for (const s of sessions) {
    const prev = lastSmoked.get(s.productId);
    if (!prev || Date.parse(s.smokedAt) > Date.parse(prev)) {
      lastSmoked.set(s.productId, s.smokedAt);
    }
  }

  return products
    .map((product) => {
      const rs = byProduct.get(product.id) ?? [];
      return {
        product,
        reviewCount: rs.length,
        avgOverall: rs.length
          ? rs.reduce((s, r) => s + r.overall, 0) / rs.length
          : 0,
        bestOverall: rs.length ? Math.max(...rs.map((r) => r.overall)) : 0,
        lastSmokedAt: lastSmoked.get(product.id),
      };
    })
    .filter((p) => p.reviewCount > 0)
    .sort((a, b) => b.avgOverall - a.avgOverall);
}

export interface AgePoint {
  restedDays: number;
  overall: number;
  smokedAt: string;
  sessionId: string;
}

export interface AgingTrend {
  product: CigarProduct;
  points: AgePoint[];
  /** Least-squares slope in score points per 30 days of rest. */
  slopePerMonth: number;
  /** Pearson r. Near 0 means rest isn't explaining the score changes. */
  correlation: number;
  firstAvg: number;
  lastAvg: number;
}

/**
 * The payoff feature: for products you've smoked repeatedly at different ages,
 * does the score actually climb with rest time? Needs at least three reviews
 * spread across different ages before the answer means anything.
 */
export function agingTrends(
  products: CigarProduct[],
  sessions: SmokeSession[],
  reviews: Review[],
  minPoints = 3,
): AgingTrend[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const pointsByProduct = new Map<string, AgePoint[]>();

  for (const review of reviews) {
    const session = sessionById.get(review.sessionId);
    if (!session || session.restedDays == null) continue;
    const list = pointsByProduct.get(review.productId) ?? [];
    list.push({
      restedDays: session.restedDays,
      overall: review.overall,
      smokedAt: session.smokedAt,
      sessionId: session.id,
    });
    pointsByProduct.set(review.productId, list);
  }

  const out: AgingTrend[] = [];
  for (const product of products) {
    const points = (pointsByProduct.get(product.id) ?? []).sort(
      (a, b) => a.restedDays - b.restedDays,
    );
    if (points.length < minPoints) continue;
    // All-same-age points carry no signal about aging, so skip them.
    const spread = new Set(points.map((p) => p.restedDays)).size;
    if (spread < 2) continue;

    const { slope, r } = linearFit(
      points.map((p) => p.restedDays),
      points.map((p) => p.overall),
    );
    const half = Math.max(1, Math.floor(points.length / 2));
    const firstAvg = mean(points.slice(0, half).map((p) => p.overall));
    const lastAvg = mean(points.slice(-half).map((p) => p.overall));

    out.push({
      product,
      points,
      slopePerMonth: slope * 30,
      correlation: r,
      firstAvg,
      lastAvg,
    });
  }

  return out.sort(
    (a, b) => Math.abs(b.slopePerMonth) - Math.abs(a.slopePerMonth),
  );
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function linearFit(xs: number[], ys: number[]): { slope: number; r: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, r: 0 };
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return { slope: 0, r: 0 };
  const slope = sxy / sxx;
  const denom = Math.sqrt(sxx * syy);
  return { slope, r: denom === 0 ? 0 : sxy / denom };
}

export interface ValuePick {
  product: CigarProduct;
  avgOverall: number;
  avgPrice: number;
  pointsPerDollar: number;
}

/** Where `value` earns its keep: score per dollar actually paid. */
export function valuePicks(
  ratings: ProductRating[],
  inventory: InventoryItem[],
): ValuePick[] {
  const priceByProduct = new Map<string, number[]>();
  for (const item of inventory) {
    if (item.pricePerStick == null) continue;
    const list = priceByProduct.get(item.productId) ?? [];
    list.push(item.pricePerStick);
    priceByProduct.set(item.productId, list);
  }

  return ratings
    .map((r) => {
      const prices = priceByProduct.get(r.product.id) ?? [];
      const avgPrice = mean(prices);
      return {
        product: r.product,
        avgOverall: r.avgOverall,
        avgPrice,
        pointsPerDollar: avgPrice > 0 ? r.avgOverall / avgPrice : 0,
      };
    })
    .filter((v) => v.avgPrice > 0)
    .sort((a, b) => b.pointsPerDollar - a.pointsPerDollar);
}

export interface FlavorCount {
  tag: string;
  count: number;
}

export function flavorFrequency(reviews: Review[], limit = 12): FlavorCount[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const tag of r.flavorTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
