"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  SectionTitle,
  Textarea,
} from "@/components/ui";
import { db, newId } from "@/lib/db";
import { useInventory, useProductMap, productLabel } from "@/lib/hooks";
import { FLAVOR_GROUPS } from "@/lib/flavors";
import { restState } from "@/lib/rest";
import { today } from "@/lib/format";
import {
  SCORE_HINTS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  computeOverall,
  scoreBand,
  type ScoreKey,
} from "@/lib/scoring";

const KEYS = Object.keys(SCORE_WEIGHTS) as ScoreKey[];

export default function LogPage() {
  return (
    <Suspense fallback={<PageHeader title="Log a smoke" />}>
      <LogForm />
    </Suspense>
  );
}

function LogForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inventory = useInventory();
  const productMap = useProductMap();

  const inStock = useMemo(
    () => inventory.filter((i) => i.qty > 0),
    [inventory],
  );

  const [itemId, setItemId] = useState(params.get("item") ?? "");
  const activeItemId = itemId || inStock[0]?.id || "";
  const item = inStock.find((i) => i.id === activeItemId);
  const product = item ? productMap.get(item.productId) : undefined;

  const [smokedAt, setSmokedAt] = useState(today());
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [pairing, setPairing] = useState("");

  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    appearance: 7,
    construction: 7,
    draw: 7,
    burn: 7,
    flavor: 7,
    complexity: 7,
  });
  const [value, setValue] = useState(7);
  const [tags, setTags] = useState<string[]>([]);
  const [wouldRebuy, setWouldRebuy] = useState(true);
  const [firstThird, setFirstThird] = useState("");
  const [secondThird, setSecondThird] = useState("");
  const [finalThird, setFinalThird] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overall = computeOverall(scores);
  const band = scoreBand(overall);
  const bandTone =
    band.tone === "great" ? "ok" : band.tone === "poor" ? "danger" : "warn";

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function save() {
    if (!item) {
      setError("Pick a cigar to log.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const sessionId = newId();
      // Snapshot the rest at smoke time. Inventory keeps ageing after this, so
      // computing it later would misreport how old the cigar actually was.
      const rested = restState(item, Date.parse(smokedAt) || Date.now()).ageDays;

      await db.sessions.add({
        id: sessionId,
        productId: item.productId,
        inventoryItemId: item.id,
        smokedAt,
        durationMin: duration ? Number(duration) : undefined,
        location: location.trim() || undefined,
        pairing: pairing.trim() || undefined,
        restedDays: rested,
        notes: notes.trim() || undefined,
        createdAt: now,
      });

      await db.reviews.add({
        id: newId(),
        sessionId,
        productId: item.productId,
        ...scores,
        value,
        overall,
        wouldRebuy,
        flavorTags: tags,
        firstThird: firstThird.trim() || undefined,
        secondThird: secondThird.trim() || undefined,
        finalThird: finalThird.trim() || undefined,
        createdAt: now,
      });

      await db.inventory.update(item.id, { qty: Math.max(0, item.qty - 1) });
      router.push("/");
    } finally {
      setSaving(false);
    }
  }

  if (inStock.length === 0) {
    return (
      <>
        <PageHeader title="Log a smoke" />
        <Card>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Nothing in stock to log. Add a cigar first.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Log a smoke"
        subtitle={
          item
            ? `Rested ${restState(item).ageDays} days before this one`
            : undefined
        }
      />

      {error && (
        <Card className="mb-3">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        </Card>
      )}

      <Card>
        <Field label="Cigar">
          <Select value={activeItemId} onChange={(e) => setItemId(e.target.value)}>
            {inStock.map((i) => (
              <option key={i.id} value={i.id}>
                {productLabel(productMap.get(i.productId))} ({i.qty} left)
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input
              type="date"
              value={smokedAt}
              onChange={(e) => setSmokedAt(e.target.value)}
            />
          </Field>
          <Field label="Minutes">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="75"
            />
          </Field>
          <Field label="Where">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Back porch"
            />
          </Field>
          <Field label="Paired with">
            <Input
              value={pairing}
              onChange={(e) => setPairing(e.target.value)}
              placeholder="Rye, neat"
            />
          </Field>
        </div>
      </Card>

      <SectionTitle>Score</SectionTitle>
      <Card>
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-4xl font-semibold tabular-nums">{overall}</span>
          <Pill tone={bandTone}>{band.label}</Pill>
        </div>

        <div className="space-y-4">
          {KEYS.map((key) => (
            <div key={key}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{SCORE_LABELS[key]}</span>
                <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>
                  {scores[key]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={scores[key]}
                aria-label={SCORE_LABELS[key]}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="mt-1 w-full"
              />
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {SCORE_HINTS[key]} &middot; {Math.round(SCORE_WEIGHTS[key] * 100)}% of score
              </p>
            </div>
          ))}

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Value for money</span>
              <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>
                {value}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={value}
              aria-label="Value for money"
              onChange={(e) => setValue(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Tracked separately - price varies by purchase, so it stays out of the score
            </p>
          </div>
        </div>
      </Card>

      <SectionTitle>Flavors</SectionTitle>
      <Card>
        <div className="space-y-3">
          {FLAVOR_GROUPS.map(({ group, tags: groupTags }) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {groupTags.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(tag)}
                      className="rounded-full border px-2.5 py-1 text-xs"
                      style={
                        on
                          ? { background: "var(--accent)", color: "#1a1208", borderColor: "transparent" }
                          : { background: "var(--surface-2)", color: "var(--muted)" }
                      }
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle>How it smoked</SectionTitle>
      <Card>
        <div className="space-y-3">
          <Field label="First third">
            <Textarea
              rows={2}
              value={firstThird}
              onChange={(e) => setFirstThird(e.target.value)}
              placeholder="Opens with..."
            />
          </Field>
          <Field label="Second third">
            <Textarea
              rows={2}
              value={secondThird}
              onChange={(e) => setSecondThird(e.target.value)}
            />
          </Field>
          <Field label="Final third">
            <Textarea
              rows={2}
              value={finalThird}
              onChange={(e) => setFinalThird(e.target.value)}
            />
          </Field>
          <Field label="Anything else">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wouldRebuy}
              onChange={(e) => setWouldRebuy(e.target.checked)}
              className="h-4 w-4"
            />
            I&apos;d buy this again
          </label>
        </div>

        <div className="mt-4">
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : `Save review (${overall})`}
          </Button>
          <p className="mt-2 text-center text-xs" style={{ color: "var(--muted)" }}>
            Logging removes one stick from {product ? productLabel(product) : "stock"}
          </p>
        </div>
      </Card>
    </>
  );
}
