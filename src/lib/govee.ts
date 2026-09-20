/**
 * Govee Platform API client.
 *
 * Two notes on the defensive parsing below. First, Govee returns sensor values
 * inside a capability list whose exact shape varies by SKU and has changed
 * between API revisions, so we walk the structure looking for humidity and
 * temperature instances rather than indexing a fixed path. Second, only WiFi
 * and gateway-backed sensors are reachable at all - a Bluetooth-only unit
 * never reports to Govee's cloud, so it simply won't appear in the device
 * list. That's a hardware limit, not a bug here.
 */

const BASE = "https://openapi.api.govee.com/router/api/v1";

export interface GoveeDevice {
  device: string;
  sku: string;
  deviceName: string;
}

export interface GoveeReading {
  rh?: number;
  tempF?: number;
}

export class GoveeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoveeError";
  }
}

function headers(apiKey: string): HeadersInit {
  return {
    "Govee-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

export async function listDevices(apiKey: string): Promise<GoveeDevice[]> {
  const res = await fetch(`${BASE}/user/devices`, {
    headers: headers(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GoveeError(
      `Govee device list failed (${res.status}).`,
      res.status === 401 || res.status === 403 ? 502 : 502,
    );
  }
  const json: unknown = await res.json();
  const data = pick(json, "data");
  if (!Array.isArray(data)) return [];

  return data.flatMap((entry): GoveeDevice[] => {
    const device = str(pick(entry, "device"));
    const sku = str(pick(entry, "sku"));
    if (!device || !sku) return [];
    return [
      {
        device,
        sku,
        deviceName: str(pick(entry, "deviceName")) ?? sku,
      },
    ];
  });
}

export async function readDeviceState(
  apiKey: string,
  sku: string,
  device: string,
): Promise<GoveeReading> {
  const res = await fetch(`${BASE}/device/state`, {
    method: "POST",
    headers: headers(apiKey),
    cache: "no-store",
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      payload: { sku, device },
    }),
  });
  if (!res.ok) {
    throw new GoveeError(`Govee state read failed (${res.status}).`, 502);
  }
  return extractReading(await res.json());
}

/**
 * Walks the whole response for anything that looks like a humidity or
 * temperature sensor reading. Govee nests these differently across SKUs, and
 * some report temperature in C while others report F, so we normalize by
 * range: a "temperature" under 45 is almost certainly Celsius, since no
 * humidor is at 45F and none survives 45C.
 */
export function extractReading(payload: unknown): GoveeReading {
  const out: GoveeReading = {};

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const instance = str(record.instance)?.toLowerCase() ?? "";
    const value = numericValue(record.state ?? record.value);

    if (value != null) {
      if (instance.includes("humidity") && out.rh == null) {
        // Govee reports some humidity values scaled by 100.
        out.rh = value > 100 ? value / 100 : value;
      } else if (instance.includes("temperature") && out.tempF == null) {
        out.tempF = value < 45 ? value * 1.8 + 32 : value;
      }
    }

    for (const child of Object.values(record)) visit(child);
  };

  visit(payload);
  return out;
}

function numericValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (raw && typeof raw === "object") {
    const inner = (raw as Record<string, unknown>).value;
    if (inner !== undefined) return numericValue(inner);
  }
  return null;
}

function pick(node: unknown, key: string): unknown {
  return node && typeof node === "object"
    ? (node as Record<string, unknown>)[key]
    : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
