"use client";

import { useState } from "react";
import type { AgingTrend } from "@/lib/analytics";

/**
 * Score against rest time for one blend, with a least-squares trend line.
 *
 * Single series, so no legend. The dots are the actual reviews; the line is the
 * fit, drawn in muted ink so it reads as derived rather than measured. Axis
 * ticks carry the values that aren't directly labeled.
 */

const W = 320;
const H = 150;
const PAD_L = 26;
const PAD_B = 18;
const PAD_T = 10;
const PAD_R = 8;

export function AgingChart({ trend }: { trend: AgingTrend }) {
  const [hover, setHover] = useState<number | null>(null);
  const { points } = trend;

  const xs = points.map((p) => p.restedDays);
  const ys = points.map((p) => p.overall);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xSpan = xMax - xMin || 1;
  const yMin = Math.max(0, Math.min(...ys) - 4);
  const yMax = Math.min(100, Math.max(...ys) + 4);
  const ySpan = yMax - yMin || 1;

  const px = (v: number) => PAD_L + ((v - xMin) / xSpan) * (W - PAD_L - PAD_R);
  const py = (v: number) => PAD_T + (1 - (v - yMin) / ySpan) * (H - PAD_T - PAD_B);

  // Re-derive the fitted endpoints from the reported slope so the drawn line
  // and the stated "points per month" can never disagree.
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slopePerDay = trend.slopePerMonth / 30;
  const fitY = (x: number) => meanY + slopePerDay * (x - meanX);

  const active = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span style={{ color: "var(--muted)" }}>Score vs. rest time</span>
        <span className="tabular-nums" style={{ color: "var(--muted)" }}>
          {active
            ? `${active.overall} at ${active.restedDays}d`
            : `${points.length} reviews`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full touch-none"
        role="img"
        aria-label={`Scores from ${Math.min(...ys)} to ${Math.max(
          ...ys,
        )} across ${xMin} to ${xMax} days of rest.`}
        onPointerLeave={() => setHover(null)}
      >
        {[yMin, (yMin + yMax) / 2, yMax].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={py(tick)}
              y2={py(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={py(tick) + 3}
              fontSize={9}
              fill="var(--muted)"
              className="tabular-nums"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}

        <line
          x1={px(xMin)}
          x2={px(xMax)}
          y1={py(fitY(xMin))}
          y2={py(fitY(xMax))}
          stroke="var(--muted)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.55}
        />

        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            cx={px(p.restedDays)}
            cy={py(p.overall)}
            r={hover === i ? 6 : 4.5}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={2}
            onPointerEnter={() => setHover(i)}
          />
        ))}

        <text x={PAD_L} y={H - 4} fontSize={9} fill="var(--muted)">
          {xMin}d
        </text>
        <text x={W - PAD_R} y={H - 4} fontSize={9} fill="var(--muted)" textAnchor="end">
          {xMax}d
        </text>
      </svg>
    </div>
  );
}
