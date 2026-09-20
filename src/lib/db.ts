import Dexie, { type EntityTable } from "dexie";
import type {
  CigarProduct,
  Humidor,
  InventoryItem,
  Reading,
  Review,
  Settings,
  SmokeSession,
  WishlistEntry,
} from "./types";

/**
 * Local-first store. Everything lives in IndexedDB on the device, which means
 * the app works in a basement humidor room with no signal and needs no account
 * to be useful. The schema mirrors supabase/migrations/0001_init.sql field for
 * field so Phase 2 sync is a transport change, not a rewrite.
 */
class HumidorDB extends Dexie {
  humidors!: EntityTable<Humidor, "id">;
  products!: EntityTable<CigarProduct, "id">;
  inventory!: EntityTable<InventoryItem, "id">;
  sessions!: EntityTable<SmokeSession, "id">;
  reviews!: EntityTable<Review, "id">;
  readings!: EntityTable<Reading, "id">;
  wishlist!: EntityTable<WishlistEntry, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("humidor");
    this.version(1).stores({
      humidors: "id, name, createdAt",
      products: "id, brand, line, vitola, [brand+line], createdAt",
      inventory: "id, productId, humidorId, acquiredOn, qty",
      sessions: "id, productId, inventoryItemId, smokedAt",
      reviews: "id, sessionId, productId, overall, createdAt",
      readings: "id, humidorId, recordedAt, [humidorId+recordedAt]",
      wishlist: "id, brand, createdAt",
      settings: "id",
    });
  }
}

export const db = new HumidorDB();

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  defaultRestDays: 21,
  goveeApiKeySet: false,
  anthropicKeySet: false,
};

/** Idempotent: gives a brand-new install one humidor so nothing is a dead end. */
export async function ensureSeeded(): Promise<void> {
  const existing = await db.settings.get("settings");
  if (!existing) await db.settings.put(DEFAULT_SETTINGS);

  const count = await db.humidors.count();
  if (count === 0) {
    await db.humidors.add({
      id: newId(),
      name: "Main Humidor",
      kind: "Desktop",
      capacity: 50,
      targetRh: 68,
      toleranceRh: 3,
      targetTempF: 68,
      mediaIntervalDays: 90,
      createdAt: new Date().toISOString(),
    });
  }
}

/** Full snapshot for backup/export. The user owns their data outright. */
export async function exportAll() {
  const [
    humidors,
    products,
    inventory,
    sessions,
    reviews,
    readings,
    wishlist,
    settings,
  ] = await Promise.all([
    db.humidors.toArray(),
    db.products.toArray(),
    db.inventory.toArray(),
    db.sessions.toArray(),
    db.reviews.toArray(),
    db.readings.toArray(),
    db.wishlist.toArray(),
    db.settings.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    humidors,
    products,
    inventory,
    sessions,
    reviews,
    readings,
    wishlist,
    settings,
  };
}

export type Backup = Awaited<ReturnType<typeof exportAll>>;

/** Replaces local data wholesale. Callers must confirm with the user first. */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.humidors,
      db.products,
      db.inventory,
      db.sessions,
      db.reviews,
      db.readings,
      db.wishlist,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.humidors.clear(),
        db.products.clear(),
        db.inventory.clear(),
        db.sessions.clear(),
        db.reviews.clear(),
        db.readings.clear(),
        db.wishlist.clear(),
        db.settings.clear(),
      ]);
      await Promise.all([
        db.humidors.bulkPut(backup.humidors ?? []),
        db.products.bulkPut(backup.products ?? []),
        db.inventory.bulkPut(backup.inventory ?? []),
        db.sessions.bulkPut(backup.sessions ?? []),
        db.reviews.bulkPut(backup.reviews ?? []),
        db.readings.bulkPut(backup.readings ?? []),
        db.wishlist.bulkPut(backup.wishlist ?? []),
        db.settings.bulkPut(backup.settings ?? [DEFAULT_SETTINGS]),
      ]);
    },
  );
}
