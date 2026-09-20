import Dexie, { type EntityTable } from "dexie";
import type {
  CigarProduct,
  Humidor,
  ID,
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

/**
 * Folds one blend into another, repointing everything that referenced it.
 *
 * Scanning the same band twice - or correcting a typo onto an identity that
 * already exists - would otherwise split one cigar's rating history across two
 * products, which is exactly what the aging analysis needs kept together.
 */
export async function mergeProducts(fromId: ID, intoId: ID): Promise<void> {
  if (fromId === intoId) return;

  await db.transaction(
    "rw",
    [db.products, db.inventory, db.sessions, db.reviews],
    async () => {
      const target = await db.products.get(intoId);
      if (!target) throw new Error("The cigar to merge into no longer exists.");

      const [items, sessions, reviews] = await Promise.all([
        db.inventory.where("productId").equals(fromId).toArray(),
        db.sessions.where("productId").equals(fromId).toArray(),
        db.reviews.where("productId").equals(fromId).toArray(),
      ]);

      await Promise.all([
        db.inventory.bulkPut(items.map((i) => ({ ...i, productId: intoId }))),
        db.sessions.bulkPut(sessions.map((s) => ({ ...s, productId: intoId }))),
        db.reviews.bulkPut(reviews.map((r) => ({ ...r, productId: intoId }))),
      ]);

      await db.products.delete(fromId);
    },
  );
}

/**
 * Removes a purchase without losing the smokes that came out of it.
 *
 * Sessions keep their `restedDays` snapshot and are merely unlinked, so
 * deleting an old box doesn't punch a hole in the rating history. A blend left
 * with no purchases and no smokes has nothing left to say, so it goes too.
 */
export async function deleteInventoryItem(id: ID): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.inventory, db.sessions, db.reviews],
    async () => {
      const item = await db.inventory.get(id);
      if (!item) return;

      const linked = await db.sessions
        .where("inventoryItemId")
        .equals(id)
        .toArray();
      await db.sessions.bulkPut(
        linked.map((s) => ({ ...s, inventoryItemId: undefined })),
      );

      await db.inventory.delete(id);

      const [remaining, smokes] = await Promise.all([
        db.inventory.where("productId").equals(item.productId).count(),
        db.sessions.where("productId").equals(item.productId).count(),
      ]);
      if (remaining === 0 && smokes === 0) {
        await db.products.delete(item.productId);
      }
    },
  );
}

/** How much history rides on a blend - shown before an edit rewrites it. */
export async function productUsage(productId: ID): Promise<{
  purchases: number;
  smokes: number;
  reviews: number;
}> {
  const [purchases, smokes, reviews] = await Promise.all([
    db.inventory.where("productId").equals(productId).count(),
    db.sessions.where("productId").equals(productId).count(),
    db.reviews.where("productId").equals(productId).count(),
  ]);
  return { purchases, smokes, reviews };
}

/** Finds a different blend already using this identity, for merge-on-save. */
export async function findProductByIdentity(
  brand: string,
  line: string,
  vitola: string,
  excludeId?: ID,
): Promise<CigarProduct | undefined> {
  const b = brand.trim().toLowerCase();
  const l = line.trim().toLowerCase();
  const v = vitola.trim().toLowerCase();
  return db.products
    .filter(
      (p) =>
        p.id !== excludeId &&
        p.brand.trim().toLowerCase() === b &&
        p.line.trim().toLowerCase() === l &&
        p.vitola.trim().toLowerCase() === v,
    )
    .first();
}
