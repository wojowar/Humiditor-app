export const money = (n: number | undefined | null): string =>
  n == null || !Number.isFinite(n)
    ? "--"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(n);

export const shortDate = (iso: string | undefined): string =>
  !iso
    ? "--"
    : new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Turns a day count into something you'd actually say out loud. */
export function humanDays(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} mo`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

export function sizeLabel(
  lengthIn?: number,
  ringGauge?: number,
): string | null {
  if (lengthIn == null && ringGauge == null) return null;
  const len = lengthIn != null ? `${lengthIn}"` : "?";
  const rg = ringGauge != null ? `${ringGauge}` : "?";
  return `${len} x ${rg}`;
}
