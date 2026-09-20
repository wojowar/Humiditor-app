"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
} from "@/components/ui";
import { db, newId } from "@/lib/db";
import { useHumidors, useInventory, useReadings } from "@/lib/hooks";
import { humidorHealth } from "@/lib/rest";
import { shortDate, today } from "@/lib/format";
import { HUMIDOR_KINDS, type Humidor, type HumidorKind } from "@/lib/types";
import { ReadingSparkline } from "@/components/ReadingSparkline";

export default function HumidorsPage() {
  const humidors = useHumidors();
  const readings = useReadings();
  const inventory = useInventory();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Humidors"
        subtitle="Conditions, capacity and maintenance."
        action={
          <button
            onClick={() => setAdding((v) => !v)}
            aria-label="Add a humidor"
            className="rounded-full border p-2"
            style={{ background: "var(--accent)", color: "#1a1208", borderColor: "transparent" }}
          >
            <Plus size={18} aria-hidden />
          </button>
        }
      />

      {adding && <NewHumidorForm onDone={() => setAdding(false)} />}

      <div className="space-y-4">
        {humidors.map((humidor) => (
          <HumidorCard
            key={humidor.id}
            humidor={humidor}
            readings={readings.filter((r) => r.humidorId === humidor.id)}
            sticks={inventory
              .filter((i) => i.humidorId === humidor.id)
              .reduce((s, i) => s + i.qty, 0)}
          />
        ))}
      </div>
    </>
  );
}

function NewHumidorForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HumidorKind>("Desktop");
  const [capacity, setCapacity] = useState("50");
  const [targetRh, setTargetRh] = useState("68");

  async function save() {
    if (!name.trim()) return;
    await db.humidors.add({
      id: newId(),
      name: name.trim(),
      kind,
      capacity: Number(capacity) || 0,
      targetRh: Number(targetRh) || 68,
      toleranceRh: 3,
      targetTempF: 68,
      mediaIntervalDays: 90,
      createdAt: new Date().toISOString(),
    });
    onDone();
  }

  return (
    <Card className="mb-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cabinet" />
        </Field>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as HumidorKind)}>
            {HUMIDOR_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Capacity">
          <Input
            type="number"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="Target RH %">
          <Input
            type="number"
            inputMode="numeric"
            value={targetRh}
            onChange={(e) => setTargetRh(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={save} className="flex-1">
          Add humidor
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function HumidorCard({
  humidor,
  readings,
  sticks,
}: {
  humidor: Humidor;
  readings: ReturnType<typeof useReadings>;
  sticks: number;
}) {
  const [rh, setRh] = useState("");
  const [temp, setTemp] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const health = humidorHealth(humidor, readings);
  const fill = humidor.capacity > 0 ? Math.min(1, sticks / humidor.capacity) : 0;

  async function logManual() {
    const value = Number(rh);
    if (!Number.isFinite(value) || value <= 0) return;
    await db.readings.add({
      id: newId(),
      humidorId: humidor.id,
      recordedAt: new Date().toISOString(),
      rh: value,
      tempF: temp ? Number(temp) : undefined,
      source: "manual",
    });
    setRh("");
    setTemp("");
  }

  async function pullFromGovee() {
    if (!humidor.goveeDeviceId || !humidor.goveeModel) {
      setSyncNote("Link a Govee device in Settings first.");
      return;
    }
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch(
        `/api/govee?sku=${encodeURIComponent(humidor.goveeModel)}&device=${encodeURIComponent(humidor.goveeDeviceId)}`,
      );
      const payload = await res.json();
      if (!res.ok) {
        setSyncNote(payload.error ?? "Could not reach Govee.");
        return;
      }
      await db.readings.add({
        id: newId(),
        humidorId: humidor.id,
        recordedAt: new Date().toISOString(),
        rh: payload.reading.rh,
        tempF: payload.reading.tempF,
        source: "govee",
      });
      setSyncNote("Reading pulled.");
    } catch {
      setSyncNote("Could not reach Govee.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{humidor.name}</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {humidor.kind} &middot; {sticks}/{humidor.capacity} sticks &middot; target{" "}
            {humidor.targetRh}%
          </p>
        </div>
        <Pill
          tone={
            health.level === "danger" ? "danger" : health.level === "warn" ? "warn" : "ok"
          }
        >
          {health.level === "ok" ? "Stable" : health.level === "warn" ? "Check" : "Action"}
        </Pill>
      </div>

      <div className="mt-3 flex items-baseline gap-4">
        <div>
          <span className="text-3xl font-semibold tabular-nums">
            {health.latest ? `${health.latest.rh.toFixed(0)}%` : "--"}
          </span>
          <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>
            RH
          </span>
        </div>
        {health.latest?.tempF != null && (
          <div>
            <span className="text-xl font-semibold tabular-nums">
              {health.latest.tempF.toFixed(0)}&deg;
            </span>
            <span className="ml-1 text-xs" style={{ color: "var(--muted)" }}>
              F
            </span>
          </div>
        )}
        {health.latest && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {shortDate(health.latest.recordedAt)}
          </span>
        )}
      </div>

      <ul className="mt-2 space-y-0.5 text-xs" style={{ color: "var(--muted)" }}>
        {health.messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>

      <ReadingSparkline
        readings={readings}
        targetRh={humidor.targetRh}
        tolerance={humidor.toleranceRh}
      />

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px]" style={{ color: "var(--muted)" }}>
          <span>Capacity</span>
          <span>{Math.round(fill * 100)}% full</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${fill * 100}%`, background: "var(--accent)" }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <Field label="Log RH %">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={rh}
            onChange={(e) => setRh(e.target.value)}
            placeholder="68"
          />
        </Field>
        <Field label="Temp F">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            placeholder="68"
          />
        </Field>
        <Button onClick={logManual} variant="ghost">
          Log
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button onClick={pullFromGovee} variant="ghost" disabled={syncing}>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} aria-hidden />
            Pull from Govee
          </span>
        </Button>
        {syncNote && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {syncNote}
          </span>
        )}
      </div>

      <MaintenanceRow humidor={humidor} dueInDays={health.mediaDueInDays} />
    </Card>
  );
}

function MaintenanceRow({
  humidor,
  dueInDays,
}: {
  humidor: Humidor;
  dueInDays?: number;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
      <div className="min-w-0 text-xs" style={{ color: "var(--muted)" }}>
        {humidor.mediaChangedOn
          ? `Media changed ${shortDate(humidor.mediaChangedOn)}${
              dueInDays != null
                ? dueInDays > 0
                  ? ` · ${dueInDays}d left`
                  : " · due now"
                : ""
            }`
          : "Humidification media never logged"}
      </div>
      <button
        onClick={() => db.humidors.update(humidor.id, { mediaChangedOn: today() })}
        className="shrink-0 whitespace-nowrap text-xs font-medium"
        style={{ color: "var(--accent)" }}
      >
        Changed today
      </button>
    </div>
  );
}
