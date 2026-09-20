"use client";

/**
 * Horizontal bars for a single measure. One series, so no legend; the value
 * rides the tip of each bar rather than appearing on a gridline. Bars are
 * capped in thickness and squared at the baseline with a rounded data-end.
 */
export function BarList({
  items,
  formatValue = (v) => String(Math.round(v)),
  emptyNote = "Not enough data yet.",
}: {
  items: { label: string; value: number; sub?: string }[];
  formatValue?: (v: number) => string;
  emptyNote?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {emptyNote}
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 0) || 1;

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
              {formatValue(item.value)}
            </span>
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-sm"
            style={{ background: "var(--surface-2)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                background: "var(--accent)",
                borderRadius: "0 4px 4px 0",
              }}
            />
          </div>
          {item.sub && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
              {item.sub}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
