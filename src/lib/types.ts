/**
 * Domain model for the humidor app.
 *
 * The important structural decision here: a `CigarProduct` (the blend, e.g.
 * "Padron 1964 Anniversary Torpedo") is separate from an `InventoryItem` (the
 * eight you bought last March). Reviews attach to the product, so ratings
 * aggregate across every purchase and every year — which is what makes the
 * "did this get better with age?" analysis possible.
 */

export type ID = string;

export type Strength =
  | "Mild"
  | "Mild-Medium"
  | "Medium"
  | "Medium-Full"
  | "Full";

export const STRENGTHS: Strength[] = [
  "Mild",
  "Mild-Medium",
  "Medium",
  "Medium-Full",
  "Full",
];

export const WRAPPERS = [
  "Connecticut Shade",
  "Connecticut Broadleaf",
  "Ecuadorian Connecticut",
  "Habano",
  "Ecuadorian Habano",
  "Corojo",
  "Criollo",
  "Maduro",
  "Oscuro",
  "Cameroon",
  "Sumatra",
  "San Andres",
  "Pennsylvania Broadleaf",
  "Candela",
  "Natural",
] as const;

export const ORIGINS = [
  "Nicaragua",
  "Dominican Republic",
  "Honduras",
  "Cuba",
  "Mexico",
  "United States",
  "Costa Rica",
  "Ecuador",
  "Brazil",
  "Peru",
  "Cameroon",
] as const;

export const VITOLAS = [
  "Robusto",
  "Toro",
  "Churchill",
  "Corona",
  "Petit Corona",
  "Double Corona",
  "Lonsdale",
  "Lancero",
  "Torpedo",
  "Belicoso",
  "Perfecto",
  "Figurado",
  "Gordo",
  "Gran Toro",
  "Panetela",
] as const;

export type HumidorKind =
  | "Desktop"
  | "Cabinet"
  | "Coolerdor"
  | "Tupperdor"
  | "Walk-in"
  | "Travel";

export const HUMIDOR_KINDS: HumidorKind[] = [
  "Desktop",
  "Cabinet",
  "Coolerdor",
  "Tupperdor",
  "Walk-in",
  "Travel",
];

export interface Humidor {
  id: ID;
  name: string;
  kind: HumidorKind;
  /** Nominal stick capacity. Used for the "how full am I" gauge. */
  capacity: number;
  targetRh: number;
  /** Acceptable drift either side of targetRh before we flag it. */
  toleranceRh: number;
  targetTempF: number;
  seasonedOn?: string;
  /** Boveda / humidification media last swapped. Drives the maintenance nudge. */
  mediaChangedOn?: string;
  /** Days between media changes; 90 is typical for Boveda. */
  mediaIntervalDays: number;
  goveeDeviceId?: string;
  goveeModel?: string;
  notes?: string;
  createdAt: string;
}

export interface CigarProduct {
  id: ID;
  brand: string;
  line: string;
  vitola: string;
  lengthIn?: number;
  ringGauge?: number;
  wrapper?: string;
  binder?: string;
  filler?: string;
  origin?: string;
  strength?: Strength;
  msrp?: number;
  /** Data URL of the band photo, when the product was created by scan. */
  photo?: string;
  /** True when a human confirmed the scan-identified fields. */
  verified: boolean;
  createdAt: string;
}

export type InventoryStatus = "resting" | "ready" | "depleted";

export interface InventoryItem {
  id: ID;
  productId: ID;
  humidorId: ID;
  /** Sticks remaining from this purchase. Hits 0 => depleted. */
  qty: number;
  qtyPurchased: number;
  acquiredOn: string;
  pricePerStick?: number;
  vendor?: string;
  /** Box code / date stamp, useful for provenance on aged boxes. */
  boxCode?: string;
  /** Days of rest this purchase wants before it's considered ready. */
  restDays: number;
  notes?: string;
  createdAt: string;
}

export interface SmokeSession {
  id: ID;
  productId: ID;
  /** Which purchase it came from, so we can price the stick and age it. */
  inventoryItemId?: ID;
  smokedAt: string;
  durationMin?: number;
  location?: string;
  pairing?: string;
  /** Days the cigar had rested when smoked. Snapshotted, since inventory moves. */
  restedDays?: number;
  notes?: string;
  photo?: string;
  createdAt: string;
}

/** Sub-scores are 0-10. `overall` is the derived 0-100 composite. */
export interface Review {
  id: ID;
  sessionId: ID;
  productId: ID;
  appearance: number;
  construction: number;
  draw: number;
  burn: number;
  flavor: number;
  complexity: number;
  /** Tracked but deliberately NOT part of `overall` - see scoring.ts. */
  value?: number;
  overall: number;
  wouldRebuy?: boolean;
  flavorTags: string[];
  /** Free-text impressions per third, the way people actually taste a cigar. */
  firstThird?: string;
  secondThird?: string;
  finalThird?: string;
  createdAt: string;
}

export type ReadingSource = "manual" | "govee";

export interface Reading {
  id: ID;
  humidorId: ID;
  recordedAt: string;
  rh: number;
  tempF?: number;
  source: ReadingSource;
}

export interface WishlistEntry {
  id: ID;
  brand: string;
  line?: string;
  vitola?: string;
  targetPrice?: number;
  notes?: string;
  createdAt: string;
}

export interface Settings {
  id: "settings";
  /** Default rest period applied to new purchases. */
  defaultRestDays: number;
  goveeApiKeySet: boolean;
  anthropicKeySet: boolean;
}
