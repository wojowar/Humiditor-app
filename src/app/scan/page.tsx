"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  SectionTitle,
} from "@/components/ui";
import { CigarFields, EMPTY_DRAFT, type CigarDraft } from "@/components/CigarFields";
import { db, newId } from "@/lib/db";
import { useHumidors, useSettings } from "@/lib/hooks";
import { prepareImage, thumbnail } from "@/lib/image";
import { today } from "@/lib/format";
import type { Strength } from "@/lib/types";

type Stage = "capture" | "identifying" | "confirm";
type Confidence = "high" | "medium" | "low";

interface Identified {
  brand: string;
  line: string;
  vitola: string;
  wrapper: string;
  origin: string;
  strength: string;
  lengthIn: number;
  ringGauge: number;
  confidence: Confidence;
  notes: string;
}

export default function ScanPage() {
  const humidors = useHumidors();
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<CigarDraft>(EMPTY_DRAFT);

  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [humidorId, setHumidorId] = useState("");
  const [restDays, setRestDays] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const activeHumidor = humidorId || humidors[0]?.id || "";
  const activeRest = restDays || String(settings?.defaultRestDays ?? 21);

  async function handleFile(file: File) {
    setError(null);
    setStage("identifying");
    try {
      const prepared = await prepareImage(file);
      setPhoto(prepared.dataUrl);

      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: prepared.base64,
          mediaType: prepared.mediaType,
        }),
      });
      const payload = await res.json();

      if (!res.ok) {
        // Identification is a convenience, never a gate - fall through to the
        // form so a failed scan still lets you type the cigar in.
        setError(payload.error ?? "Identification failed.");
        setDraft(EMPTY_DRAFT);
        setConfidence(null);
        setModelNote(null);
        setStage("confirm");
        return;
      }

      const result = payload.result as Identified;
      setDraft({
        brand: result.brand ?? "",
        line: result.line ?? "",
        vitola: result.vitola ?? "",
        lengthIn: result.lengthIn ? String(result.lengthIn) : "",
        ringGauge: result.ringGauge ? String(result.ringGauge) : "",
        wrapper: result.wrapper ?? "",
        origin: result.origin ?? "",
        strength: result.strength ?? "",
      });
      setConfidence(result.confidence);
      setModelNote(result.notes || null);
      setStage("confirm");
    } catch {
      setError("Could not read that photo.");
      setStage("capture");
    }
  }

  function resetForNext() {
    setDraft(EMPTY_DRAFT);
    setPhoto(null);
    setConfidence(null);
    setModelNote(null);
    setQty("1");
    setPrice("");
    setError(null);
    setStage("capture");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(andContinue: boolean) {
    if (!draft.brand.trim()) {
      setError("Give it a brand at least, so you can find it later.");
      return;
    }
    if (!activeHumidor) {
      setError("Create a humidor first.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const smallPhoto = photo ? await thumbnail(photo) : undefined;

      // Reuse an existing blend when it matches, so ratings keep aggregating
      // onto one product rather than splitting across duplicate entries.
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
        await db.products.update(productId, { verified: true });
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
          photo: smallPhoto,
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
        acquiredOn: today(),
        pricePerStick: price ? Number(price) : undefined,
        restDays: Number(activeRest) || 0,
        createdAt: now,
      });

      setAdded((prev) => [
        `${draft.brand} ${draft.line}`.trim() + ` x${quantity}`,
        ...prev,
      ]);

      if (andContinue) resetForNext();
      else {
        resetForNext();
        setStage("capture");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Scan a band"
        subtitle="Photograph the band and confirm what it read. Built for working through a box at a time."
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && (
        <Card className="mb-3">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        </Card>
      )}

      {stage === "capture" && (
        <Card className="text-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="mx-auto flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed"
            style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
          >
            <Camera size={34} aria-hidden />
            <span className="text-sm font-medium">Take photo</span>
          </button>
          <p className="mx-auto mt-4 max-w-sm text-sm" style={{ color: "var(--muted)" }}>
            Fill the frame with the band and keep it in focus. You can correct
            anything it gets wrong before saving.
          </p>
        </Card>
      )}

      {stage === "identifying" && (
        <Card className="flex flex-col items-center gap-3 py-10">
          <Loader2 size={26} className="animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Reading the band...
          </p>
        </Card>
      )}

      {stage === "confirm" && (
        <div className="space-y-4">
          <Card>
            <div className="flex gap-4">
              {photo && (
                <Image
                  src={photo}
                  alt="The band you photographed"
                  width={96}
                  height={96}
                  unoptimized
                  className="h-24 w-24 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Identified</span>
                  {confidence && (
                    <Pill
                      tone={
                        confidence === "high"
                          ? "ok"
                          : confidence === "medium"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {confidence} confidence
                    </Pill>
                  )}
                </div>
                {modelNote && (
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {modelNote}
                  </p>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1 text-xs"
                  style={{ color: "var(--accent)" }}
                >
                  <RefreshCw size={13} aria-hidden /> Retake
                </button>
              </div>
            </div>
          </Card>

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
              <Field label="Humidor">
                <Select
                  value={activeHumidor}
                  onChange={(e) => setHumidorId(e.target.value)}
                >
                  {humidors.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rest days" hint="Before it counts as ready">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={activeRest}
                  onChange={(e) => setRestDays(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={() => save(true)} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save & scan next"}
              </Button>
              <Button variant="ghost" onClick={() => save(false)} disabled={saving}>
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}

      {added.length > 0 && (
        <>
          <SectionTitle>Added this session ({added.length})</SectionTitle>
          <Card>
            <ul className="space-y-1 text-sm" style={{ color: "var(--muted)" }}>
              {added.slice(0, 8).map((label, i) => (
                <li key={`${label}-${i}`}>{label}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
