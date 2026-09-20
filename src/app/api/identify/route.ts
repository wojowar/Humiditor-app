import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Band-photo identification.
 *
 * This runs server-side for one reason above all: ANTHROPIC_API_KEY must never
 * reach the browser. The client posts a base64 frame, we call the model, and
 * only the parsed fields come back.
 */

export const runtime = "nodejs";
// Never cache an identification - every photo is a different cigar.
export const dynamic = "force-dynamic";

const ACCEPTED_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

// ~6MB of base64 is roughly a 4.5MB image; comfortably under the API's limit
// while still leaving room for a phone camera frame.
const MAX_BASE64_CHARS = 6_000_000;

const IdentifiedCigar = z.object({
  brand: z
    .string()
    .describe("Manufacturer, e.g. 'Padron'. Empty string if unreadable."),
  line: z
    .string()
    .describe("Specific line or blend, e.g. '1964 Anniversary'."),
  vitola: z
    .string()
    .describe("Shape name if visible or inferable, e.g. 'Torpedo'. May be empty."),
  wrapper: z.string().describe("Wrapper leaf if identifiable, else empty."),
  origin: z.string().describe("Country of origin if known, else empty."),
  strength: z
    .enum(["", "Mild", "Mild-Medium", "Medium", "Medium-Full", "Full"])
    .describe("Typical strength of this blend, empty if unsure."),
  lengthIn: z
    .number()
    .describe("Length in inches if determinable, otherwise 0."),
  ringGauge: z.number().describe("Ring gauge if determinable, otherwise 0."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How sure you are of brand and line specifically."),
  notes: z
    .string()
    .describe("One short sentence: what you read off the band, or why unsure."),
});

const RequestBody = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(ACCEPTED_MEDIA),
});

const SYSTEM = `You identify cigars from photographs of their bands.

Read what is actually printed on the band - brand, line, and any size or
origin markings - and combine it with what you know about that maker's
catalogue. Report only what the image supports.

Rules:
- If the brand is legible but the line is not, fill brand and leave line empty.
- Never invent a line, size, or wrapper to fill a field. Empty is correct when
  you cannot tell; a confident wrong answer costs the user more than a blank.
- Set confidence to "low" whenever the band is blurred, cropped, or partly
  hidden, even if your guess feels plausible.
- lengthIn and ringGauge should be 0 unless the size is printed on the band or
  the line has exactly one well-known size.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable band scanning.",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof RequestBody>;
  try {
    body = RequestBody.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Expected { imageBase64, mediaType } with a supported image type." },
      { status: 400 },
    );
  }

  if (body.imageBase64.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Image is too large. Retake it at a lower resolution." },
      { status: 413 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      system: SYSTEM,
      // Identification is a bounded extraction task, and every result passes
      // through a human confirmation step in the UI - so medium effort keeps
      // bulk scanning responsive without meaningfully hurting accuracy.
      output_config: {
        effort: "medium",
        format: zodOutputFormat(IdentifiedCigar),
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.mediaType,
                data: body.imageBase64,
              },
            },
            {
              type: "text",
              text: "Identify this cigar from its band.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to process that image." },
        { status: 422 },
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not read a cigar band in that photo. Try again closer." },
        { status: 422 },
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic rejected the API key." },
        { status: 502 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by Anthropic. Wait a moment and retry." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error (${error.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Identification failed unexpectedly." },
      { status: 500 },
    );
  }
}
