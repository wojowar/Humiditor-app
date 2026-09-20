"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, PageHeader, Select, SectionTitle } from "@/components/ui";
import { CigarFields, EMPTY_DRAFT, type CigarDraft } from "@/components/CigarFields";
import { db, newId } from "@/lib/db";
import { useHumidors, useSettings } from "@/lib/hooks";
import { today } from "@/lib/format";
import type { Strength } from "@/lib/types";

export default function NewCigarPage() {
  const router = useRouter();
  const humidors = useHumidors();
  const settings = useSettings();

  const [draft, setDraft] = useState<CigarDraft>(EMPTY_DRAFT);
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [vendor, setVendor] = useState("");
  const [boxCode, setBoxCode] = useState("");
  const [acquiredOn, setAcquiredOn] = useState(today());
  const [humidorId, setHumidorId] = useState("");
  const [restDays, setRestDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeHumidor = humidorId || humidors[0]?.id || "";
  const activeRest = restDays || String(settings?.defaultRestDays ?? 21);

  async function save() {
    if (!draft.brand.trim()) {
      setError("A brand is the minimum - everything else can come later.");
      return;
    }
    if (!activeHumidor) {
      setError("Create a humidor first.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const match = await db.products
        .filter(
          (p) =>
            p.brand.toLowerCase() === draft.brand.trim().toLowerCase() &&
            p.line.toLowerCase() === draft.line.trim().toLowerCase() &&
            p.vitola.toLowerCase() === draft.vitola.trim().toLowerCase(),
        )
        .first();

      let productId: string;
      if (match) {
        productId = match.id;
      } else {
        productId = newId();
        await db.products.add({
          id: productId,
          brand: draft.brand.trim(),
          line: draft.line.trim(),
          vitola: draft.vitola.trim(),
          lengthIn: draft.lengthIn ? Number(draft.lengthIn) : undefined,
          ringGauge: draft.ringGauge ? Number(draft.ringGauge) : undefined,
          wrapper: draft.wrapper || undefined,
          origin: draft.origin || undefined,
          strength: (draft.strength || undefined) as Strength | undefined,
          verified: true,
          createdAt: now,
        });
      }

      const quantity = Math.max(1, Number(qty) || 1);
      await db.inventory.add({
        id: newId(),
        productId,
        humidorId: activeHumidor,
        qty: quantity,
        qtyPurchased: quantity,
        acquiredOn,
        pricePerStick: price ? Number(price) : undefined,
        vendor: vendor.trim() || undefined,
        boxCode: boxCode.trim() || undefined,
        restDays: Number(activeRest) || 0,
        createdAt: now,
      });

      router.push("/inventory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Add a cigar" subtitle="For when you'd rather type than scan." />

      {error && (
        <Card className="mb-3">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        </Card>
      )}

      <Card>
        <CigarFields draft={draft} onChange={setDraft} />
      </Card>

      <SectionTitle>This purchase</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Price each">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12.50"
            />
          </Field>
          <Field label="Acquired">
            <Input
              type="date"
              value={acquiredOn}
              onChange={(e) => setAcquiredOn(e.target.value)}
            />
          </Field>
          <Field label="Rest days">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={activeRest}
              onChange={(e) => setRestDays(e.target.value)}
            />
          </Field>
          <Field label="Vendor">
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Local B&M"
            />
          </Field>
          <Field label="Box code" hint="Useful on aged boxes">
            <Input
              value={boxCode}
              onChange={(e) => setBoxCode(e.target.value)}
              placeholder="MAO NOV 23"
            />
          </Field>
        </div>

        <Field label="Humidor">
          <Select value={activeHumidor} onChange={(e) => setHumidorId(e.target.value)}>
            {humidors.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-4">
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Add to humidor"}
          </Button>
        </div>
      </Card>
    </>
  );
}
