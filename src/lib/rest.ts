import type { Humidor, InventoryItem, Reading } from "./types";

export const MS_PER_DAY = 86_400_000;

export function daysSince(iso: string | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / MS_PER_DAY));
}

export interface RestState {
  ageDays: number;
  restDays: number;
  daysRemaining: number;
  ready: boolean;
  progress: number;
}

/**
 * Cigars arrive stressed from shipping and need to settle before they show
 * their real character. Until the rest window closes we hold them back so you
 * don't burn a good stick judging it at its worst.
 */
export function restState(item: InventoryItem, now = Date.now()): RestState {
  const ageDays = daysSince(item.acquiredOn, now);
  const restDays = Math.max(0, item.restDays ?? 0);
  const daysRemaining = Math.max(0, restDays - ageDays);
  return {
    ageDays,
    restDays,
    daysRemaining,
    ready: daysRemaining === 0,
    progress: restDays === 0 ? 1 : Math.min(1, ageDays / restDays),
  };
}

export type HumidorAlertLevel = "ok" | "warn" | "danger";

export interface HumidorHealth {
  level: HumidorAlertLevel;
  messages: string[];
  latest?: Reading;
  mediaDueInDays?: number;
}

/**
 * Beetle eggs in tobacco can hatch once it gets warm enough, and the usual
 * guidance is to keep below the mid-70s F. Dry swings crack wrappers; wet ones
 * invite mold. Hence two-sided RH checks and a one-sided temperature check.
 */
export const BEETLE_RISK_TEMP_F = 73;

export function humidorHealth(
  humidor: Humidor,
  readings: Reading[],
  now = Date.now(),
): HumidorHealth {
  const messages: string[] = [];
  let level: HumidorAlertLevel = "ok";

  const bump = (next: HumidorAlertLevel) => {
    const rank = { ok: 0, warn: 1, danger: 2 } as const;
    if (rank[next] > rank[level]) level = next;
  };

  const latest = [...readings].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  )[0];

  if (!latest) {
    messages.push("No readings logged yet.");
    bump("warn");
  } else {
    const staleDays = daysSince(latest.recordedAt, now);
    const tol = humidor.toleranceRh || 3;
    const drift = latest.rh - humidor.targetRh;

    if (Math.abs(drift) > tol * 2) {
      messages.push(
        `RH ${latest.rh.toFixed(0)}% is well ${drift > 0 ? "above" : "below"} the ${humidor.targetRh}% target.`,
      );
      bump("danger");
    } else if (Math.abs(drift) > tol) {
      messages.push(
        `RH ${latest.rh.toFixed(0)}% is drifting ${drift > 0 ? "high" : "low"}.`,
      );
      bump("warn");
    }

    if (latest.tempF != null && latest.tempF >= BEETLE_RISK_TEMP_F) {
      messages.push(
        `${latest.tempF.toFixed(0)}°F is in the beetle-risk range - cool it down.`,
      );
      bump("danger");
    }

    if (staleDays > 14) {
      messages.push(`Last reading was ${staleDays} days ago.`);
      bump("warn");
    }
  }

  let mediaDueInDays: number | undefined;
  if (humidor.mediaChangedOn) {
    const elapsed = daysSince(humidor.mediaChangedOn, now);
    mediaDueInDays = (humidor.mediaIntervalDays || 90) - elapsed;
    if (mediaDueInDays <= 0) {
      messages.push("Humidification media is due for a change.");
      bump("warn");
    }
  }

  if (messages.length === 0) messages.push("Holding steady.");
  return { level, messages, latest, mediaDueInDays };
}
