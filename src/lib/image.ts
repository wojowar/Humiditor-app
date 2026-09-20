/**
 * Downscales a camera frame before it leaves the device. Phone cameras produce
 * 4000px JPEGs; the band fills a small part of that and the model doesn't need
 * the rest. Shrinking first keeps uploads quick on a lounge's bad wifi, which
 * matters when you're scanning a whole humidor in one sitting.
 */
const MAX_EDGE = 1280;
const QUALITY = 0.82;

export interface PreparedImage {
  base64: string;
  mediaType: "image/jpeg";
  dataUrl: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Could not encode that photo.");

  return {
    base64: dataUrl.slice(comma + 1),
    mediaType: "image/jpeg",
    dataUrl,
  };
}

/** A smaller copy for storage - full frames would bloat IndexedDB fast. */
export async function thumbnail(dataUrl: string, edge = 320): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, edge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
