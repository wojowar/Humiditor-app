"use client";

import { useMemo, useState } from "react";
import type { Reading } from "@/lib/types";

/**
 * RH over time for one humidor.
 *
 * Single series, so no legend - the heading says what is plotted. The target
 * band is a neutral wash rather than a colored series: being *outside the
 * shaded band* is what marks a reading as out of range, with a larger dot
 * reinforcing it. Hue is never the only cue, because the amber and red in this
 * theme sit about 8 dE apart and are genuinely hard to tell apart.
 */

const W = 320;
const H = 72;
const PAD_Y = 8;
const MAX_POINTS = 60;

export function ReadingSparkline({
  readings,
  targetRh,
  tolerance,
}: {
  readings: Reading[];
  targetRh: number;
  tolerance: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(
    () =>
      [...readings]
        .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
        .slice(-MAX_POINTS),
    [readings],
  );

  if (points.length < 2) {
    return (
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        Log at least two readings to see a trend.
      </p>
    );
  }

  const values = points.map((p) => p.rh);
  const lo = Math.min(...values, targetRh - tolerance) - 1;
  const hi = Math.max(...values, targetRh + tolerance) + 1;
  const span = hi - lo || 1;

  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => PAD_Y + (1 - (v - lo) / span) * (H - PAD_Y * 2);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rh)}`).join(" ");
  const bandTop = y(targetRh + tolerance);
  const bandBottom = y(targetRh - tolerance);
  const outOfBand = (v: number) => Math.abs(v - targetRh) > tolerance;

  const active = hover != null ? points[hover] : points[points.length - 1];

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[11px]">
        <span style={{ color: "var(--muted)" }}>
          Humidity, last {points.length} readings
        </span>
        <span className="tabular-nums" style={{ color: "var(--muted)" }}>
          {active.rh.toFixed(0)}% &middot;{" "}
          {new Date(active.recordedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full touch-none"
        style={{ height: H }}
        role="img"
        aria-label={`Humidity between ${Math.min(...values).toFixed(0)} and ${Math.max(
          ...values,
        ).toFixed(0)} percent against a target of ${targetRh} percent.`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, idx)));
        }}
      >
        {/* Target band - context, not a series, so it stays neutral. */}
        <rect
          x={0}
          y={bandTop}
          width={W}
          height={Math.max(1, bandBottom - bandTop)}
          fill="var(--muted)"
          opacity={0.14}
        />
        <line
          x1={0}
          x2={W}
          y1={y(targetRh)}
          y2={y(targetRh)}
          stroke="var(--muted)"
          strokeWidth={1}
          opacity={0.5}
        />

        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const bad = outOfBand(p.rh);
          const isActive = hover === i;
          if (!bad && !isActive && i !== points.length - 1) return null;
          return (
            <circle
              key={p.id}
              cx={x(i)}
              cy={y(p.rh)}
              r={bad || isActive ? 4 : 3}
              fill={bad ? "var(--danger)" : "var(--accent)"}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          );
        })}

        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={H}
            stroke="var(--muted)"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
      </svg>
    </div>
  );
}
