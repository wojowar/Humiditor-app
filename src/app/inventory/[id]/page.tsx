"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Pill,
  Select,
  SectionTitle,
} from "@/components/ui";
import { CigarFields, type CigarDraft } from "@/components/CigarFields";
import {
  db,
  deleteInventoryItem,
  findProductByIdentity,
  mergeProducts,
  productUsage,
} from "@/lib/db";
import { useHumidors } from "@/lib/hooks";
import { restState } from "@/lib/rest";
import { humanDays } from "@/lib/format";
import type {
  CigarProduct,
  Humidor,
  InventoryItem,
  Strength,
} from "@/lib/types";

interface Usage {
  purchases: number;
  smokes: number;
  reviews: number;
}

export default function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const humidors = useHumidors();

  // One query for the whole record. Dexie returns undefined for a missing row,
  // which useLiveQuery also uses for "still loading"; fetching the item and its
  // blend separately would briefly report "not found" while the second caught
  // up, so they resolve together and undefined means loading, nothing else.
  const record = useLiveQuery(async () => {
    const item = (await db.inventory.get(id)) ?? null;
    if (!item) return { item: null, product: null, usage: null };
    const [product, usage] = await Promise.all([
      db.products.get(item.productId),
      productUsage(item.productId),
    ]);
    return { item, product: product ?? null, usage };
  }, [id]);

  if (record === undefined) {
    return (
      <>
        <PageHeader title="Edit cigar" />
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading...
        </p>
      </>
    );
  }

  if (!record.item || !record.product) {
    return (
      <>
        <PageHeader title="Edit cigar" />
        <Empty
          title="Not found"
          body="That purchase is no longer in your humidor."
          action={<LinkButton href="/inventory">Back to cigars</LinkButton>}
        />
      </>
    );
  }

  return (
    <EditForm
      // Remounting on a different purchase re-seeds the form from that record,
      // which is why the fields below can initialize straight from props.
      key={record.item.id}
      item={record.item}
      product={record.product}
      usage={record.usage}
      humidors={humidors}
    />
  );
}

function EditForm({
  item,
  product,
  usage,
  humidors,
}: {
  item: InventoryItem;
  product: CigarProduct;
  usage: Usage | null;
  humidors: Humidor[];
}) {
  const router = useRouter();

  const [draft, setDraft] = useState<CigarDraft>({
    brand: product.brand,
    line: product.line,
    vitola: product.vitola,
    lengthIn: product.lengthIn != null ? String(product.lengthIn) : "",
    ringGauge: product.ringGauge != null ? String(product.ringGauge) : "",
    wrapper: product.wrapper ?? "",
    origin: product.origin ?? "",
    strength: product.strength ?? "",
  });
  const [qty, setQty] = useState(String(item.qty));
  const [price, setPrice] = useState(
    item.pricePerStick != null ? String(item.pricePerStick) : "",
  );
  const [vendor, setVendor] = useState(item.vendor ?? "");
  const [boxCode, setBoxCode] = useState(item.boxCode ?? "");
  const [acquiredOn, setAcquiredOn] = useState(item.acquiredOn);
  const [restDays, setRestDays] = useState(String(item.restDays));
  const [humidorId, setHumidorId] = useState(item.humidorId);
  const [notes, setNotes] = useState(item.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save() {
    if (!draft.brand.trim()) {
      setError("A brand is the minimum - everything else can come later.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const identityChanged =
        draft.brand.trim() !== product.brand ||
        draft.line.trim() !== product.line ||
        draft.vitola.trim() !== product.vitola;

      // Renaming onto an identity that already exists would split one cigar's
      // history in two, so fold this blend into that one instead.
      let targetProductId = item.productId;
      if (identityChanged) {
        const clash = await findProductByIdentity(
          draft.brand,
          draft.line,
          draft.vitola,
          item.productId,
        );
        if (clash) {
          const ok = window.confirm(
            `You already have "${[clash.brand, clash.line, clash.vitola]
              .filter(Boolean)
              .join(" ")}". Merge this one into it? ` +
              "Purchases and reviews move across; nothing is lost.",
          );
          if (!ok) {
            setSaving(false);
            return;
          }
          await mergeProducts(item.productId, clash.id);
          targetProductId = clash.id;
        }
      }

      if (targetProductId === item.productId) {
        await db.products.update(item.productId, {
          brand: draft.brand.trim(),
          line: draft.line.trim(),
          vitola: draft.vitola.trim(),
          lengthIn: draft.lengthIn ? Number(draft.lengthIn) : undefined,
          ringGauge: draft.ringGauge ? Number(draft.ringGauge) : undefined,
          wrapper: draft.wrapper || undefined,
          origin: draft.origin || undefined,
          strength: (draft.strength || undefined) as Strength | undefined,
          verified: true,
        });
      }

      await db.inventory.update(item.id, {
        productId: targetProductId,
        humidorId: humidorId || item.humidorId,
        qty: Math.max(0, Number(qty) || 0),
        pricePerStick: price ? Number(price) : undefined,
        vendor: vendor.trim() || undefined,
        boxCode: boxCode.trim() || undefined,
        acquiredOn: acquiredOn || item.acquiredOn,
        restDays: Math.max(0, Number(restDays) || 0),
        notes: notes.trim() || undefined,
      });

      router.push("/inventory");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save those changes.");
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await deleteInventoryItem(item.id);
      router.push("/inventory");
    } catch {
      setError("Could not delete that purchase.");
      setSaving(false);
    }
  }

  const rest = restState(item);
  const shared =
    usage && (usage.purchases > 1 || usage.reviews > 0) ? usage : null;

  return (
    <>
      <PageHeader
        title="Edit cigar"
        subtitle={`Bought ${humanDays(rest.ageDays)} ago · ${item.qty} of ${item.qtyPurchased} left`}
      />

      {error && (
        <Card className="mb-3">
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        </Card>
      )}

      <SectionTitle>The blend</SectionTitle>
      {shared && (
        <Card className="mb-2">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            These fields describe the cigar itself, not this box, so changes
            reach {sharedScope(shared)}.
          </p>
        </Card>
      )}
      <Card>
        <CigarFields draft={draft} onChange={setDraft} />
      </Card>

      <SectionTitle>This purchase</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity left">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Price each">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12.50"
            />
          </Field>
          <Field label="Acquired">
            <Input
              type="date"
              value={acquiredOn}
              onChange={(e) => setAcquiredOn(e.target.value)}
            />
          </Field>
          <Field label="Rest days">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={restDays}
              onChange={(e) => setRestDays(e.target.value)}
            />
          </Field>
          <Field label="Vendor">
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Box code">
            <Input value={boxCode} onChange={(e) => setBoxCode(e.target.value)} />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Humidor">
            <Select
              value={humidorId}
              onChange={(e) => setHumidorId(e.target.value)}
            >
              {humidors.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-3">
          {rest.ready ? (
            <Pill tone="ok">Rested {humanDays(rest.ageDays)}</Pill>
          ) : (
            <Pill tone="warn">{rest.daysRemaining} days of rest left</Pill>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Card>
        {confirmingDelete ? (
          <>
            <p className="text-sm">
              Delete this purchase? Smokes you already logged from it are kept -
              they just stop being linked to a box.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={remove} disabled={saving}>
                Yes, delete it
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--danger)" }}
          >
            <Trash2 size={15} aria-hidden />
            Delete this purchase
          </button>
        )}
      </Card>
    </>
  );
}

/** Says what an edit to the blend will touch, without mangling the grammar. */
function sharedScope({ purchases, reviews }: Usage): string {
  const parts: string[] = [];
  if (purchases > 1) parts.push(`all ${purchases} purchases`);
  if (reviews > 0) {
    parts.push(reviews === 1 ? "1 review" : `${reviews} reviews`);
  }
  if (parts.length === 0) return "this purchase";
  if (purchases <= 1) parts.unshift("this purchase");
  return parts.join(" and ");
}
