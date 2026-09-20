"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

export function useHumidors() {
  return useLiveQuery(() => db.humidors.toArray(), [], []);
}

export function useProducts() {
  return useLiveQuery(() => db.products.toArray(), [], []);
}

export function useInventory() {
  return useLiveQuery(() => db.inventory.toArray(), [], []);
}

export function useSessions() {
  return useLiveQuery(
    () => db.sessions.orderBy("smokedAt").reverse().toArray(),
    [],
    [],
  );
}

export function useReviews() {
  return useLiveQuery(() => db.reviews.toArray(), [], []);
}

export function useReadings() {
  return useLiveQuery(() => db.readings.toArray(), [], []);
}

export function useSettings() {
  return useLiveQuery(() => db.settings.get("settings"), [], undefined);
}

/** Index products by id for the many places that join inventory to catalogue. */
export function useProductMap() {
  const products = useProducts();
  return new Map(products.map((p) => [p.id, p]));
}

export function productLabel(
  p: { brand: string; line: string; vitola: string } | undefined,
): string {
  if (!p) return "Unknown cigar";
  return [p.brand, p.line, p.vitola].filter(Boolean).join(" ").trim() || "Unnamed";
}
