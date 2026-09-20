"use client";

import { useRef, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  SectionTitle,
} from "@/components/ui";
import { db, exportAll, importAll, type Backup } from "@/lib/db";
import { useTheme, type Theme } from "@/lib/theme";
import { useHumidors, useSettings } from "@/lib/hooks";

interface GoveeDevice {
  device: string;
  sku: string;
  deviceName: string;
}

export default function SettingsPage() {
  const settings = useSettings();
  const humidors = useHumidors();
  const fileRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useTheme();
  const [devices, setDevices] = useState<GoveeDevice[]>([]);
  const [goveeNote, setGoveeNote] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  async function loadDevices() {
    setLoadingDevices(true);
    setGoveeNote(null);
    try {
      const res = await fetch("/api/govee");
      const payload = await res.json();
      if (!res.ok) {
        setGoveeNote(payload.error ?? "Could not reach Govee.");
        setDevices([]);
        return;
      }
      setDevices(payload.devices ?? []);
      if ((payload.devices ?? []).length === 0) {
        setGoveeNote(
          "No devices returned. Bluetooth-only Govee sensors don't report to the cloud - those need a gateway.",
        );
      }
    } catch {
      setGoveeNote("Could not reach Govee.");
    } finally {
      setLoadingDevices(false);
    }
  }

  async function downloadBackup() {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `humidor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportNote(null);
    try {
      const parsed = JSON.parse(await file.text()) as Backup;
      if (!parsed || typeof parsed !== "object" || !("version" in parsed)) {
        setImportNote("That doesn't look like a humidor backup.");
        return;
      }
      const confirmed = window.confirm(
        "Importing replaces everything currently in this app. Continue?",
      );
      if (!confirmed) return;
      await importAll(parsed);
      setImportNote("Imported.");
    } catch {
      setImportNote("Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <PageHeader title="Settings" />

      <SectionTitle>Defaults</SectionTitle>
      <Card>
        <Field
          label="Default rest days"
          hint="Applied to new purchases. Most cigars want two to three weeks after shipping."
        >
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={settings?.defaultRestDays ?? 21}
            onChange={(e) =>
              db.settings.update("settings", {
                defaultRestDays: Number(e.target.value) || 0,
              })
            }
          />
        </Field>

        <div className="mt-3">
          <Field label="Appearance">
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
            >
              <option value="system">Match system</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </Field>
        </div>
      </Card>

      <SectionTitle>Govee hygrometer</SectionTitle>
      <Card>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Link a humidor to a Govee sensor so you can pull readings instead of
          typing them. Requires GOVEE_API_KEY on the server and a WiFi or
          gateway-backed device.
        </p>
        <div className="mt-3">
          <Button onClick={loadDevices} variant="ghost" disabled={loadingDevices}>
            {loadingDevices ? "Looking..." : "Find devices"}
          </Button>
        </div>
        {goveeNote && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {goveeNote}
          </p>
        )}

        {devices.length > 0 && (
          <div className="mt-4 space-y-3">
            {humidors.map((humidor) => (
              <Field key={humidor.id} label={humidor.name}>
                <Select
                  value={humidor.goveeDeviceId ?? ""}
                  onChange={(e) => {
                    const match = devices.find((d) => d.device === e.target.value);
                    db.humidors.update(humidor.id, {
                      goveeDeviceId: match?.device,
                      goveeModel: match?.sku,
                    });
                  }}
                >
                  <option value="">Not linked</option>
                  {devices.map((d) => (
                    <option key={d.device} value={d.device}>
                      {d.deviceName} ({d.sku})
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        )}
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Everything lives in this browser. Nothing syncs anywhere, so take a
          backup before clearing site data or switching phones.
        </p>
        <div className="mt-3 flex gap-2">
          <Button onClick={downloadBackup} variant="ghost">
            Export backup
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="ghost">
            Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
        {importNote && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {importNote}
          </p>
        )}
      </Card>
    </>
  );
}
