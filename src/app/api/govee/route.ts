import { NextResponse } from "next/server";
import { GoveeError, listDevices, readDeviceState } from "@/lib/govee";

/**
 * Proxy for the Govee cloud API. Exists so GOVEE_API_KEY stays server-side,
 * and because Govee does not send CORS headers a browser would accept.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireKey(): string | null {
  return process.env.GOVEE_API_KEY || null;
}

export async function GET(request: Request) {
  const apiKey = requireKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOVEE_API_KEY is not set.", configured: false },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku");
  const device = searchParams.get("device");

  try {
    if (sku && device) {
      const reading = await readDeviceState(apiKey, sku, device);
      if (reading.rh == null) {
        return NextResponse.json(
          {
            error:
              "That device reported no humidity value. Only hygrometer-class Govee devices are supported.",
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ reading });
    }

    const devices = await listDevices(apiKey);
    return NextResponse.json({ devices, configured: true });
  } catch (error) {
    if (error instanceof GoveeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Could not reach Govee." },
      { status: 502 },
    );
  }
}
