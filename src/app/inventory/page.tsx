"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Card,
  Empty,
  Input,
  LinkButton,
  PageHeader,
  Pill,
} from "@/components/ui";
import {
  useHumidors,
  useInventory,
  useProductMap,
  useReviews,
  productLabel,
} from "@/lib/hooks";
import { restState } from "@/lib/rest";
import { humanDays, money, sizeLabel } from "@/lib/format";

type Filter = "all" | "ready" | "resting";

export default function InventoryPage() {
  const inventory = useInventory();
  const humidors = useHumidors();
  const reviews = useReviews();
  const productMap = useProductMap();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const humidorName = new Map(humidors.map((h) => [h.id, h.name]));

  const avgByProduct = useMemo(() => {
    const sums = new Map<string, { total: number; n: number }>();
    for (const r of reviews) {
      const prev = sums.get(r.productId) ?? { total: 0, n: 0 };
      sums.set(r.productId, { total: prev.total + r.overall, n: prev.n + 1 });
    }
    return new Map(
      [...sums.entries()].map(([id, { total, n }]) => [id, total / n]),
    );
  }, [reviews]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory
      .filter((item) => item.qty > 0)
      .filter((item) => {
        const rest = restState(item);
        if (filter === "ready") return rest.ready;
        if (filter === "resting") return !rest.ready;
        return true;
      })
      .filter((item) => {
        if (!needle) return true;
        const product = productMap.get(item.productId);
        return productLabel(product).toLowerCase().includes(needle);
      })
      .sort((a, b) =>
        productLabel(productMap.get(a.productId)).localeCompare(
          productLabel(productMap.get(b.productId)),
        ),
      );
  }, [inventory, filter, query, productMap]);

  const totalSticks = rows.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <PageHeader
        title="Cigars"
        subtitle={`${totalSticks} sticks in ${rows.length} entries · tap one to edit`}
        action={
          <Link
            href="/inventory/new"
            aria-label="Add a cigar manually"
            className="rounded-full border p-2"
            style={{ background: "var(--accent)", color: "#1a1208", borderColor: "transparent" }}
          >
            <Plus size={18} aria-hidden />
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--muted)" }}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your humidor"
          className="pl-9"
          type="search"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "ready", "resting"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium capitalize"
            style={
              filter === f
                ? { background: "var(--accent)", color: "#1a1208", borderColor: "transparent" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty
          title={query ? "Nothing matches" : "No cigars yet"}
          body={
            query
              ? "Try a different search."
              : "Scan a band to add one in a few seconds, or enter it by hand."
          }
          action={!query ? <LinkButton href="/scan">Scan a band</LinkButton> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((item) => {
            const product = productMap.get(item.productId);
            const rest = restState(item);
            const avg = avgByProduct.get(item.productId);
            const size = sizeLabel(product?.lengthIn, product?.ringGauge);
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/inventory/${item.id}`}
                    className="min-w-0 flex-1"
                    aria-label={`Edit ${productLabel(product)}`}
                  >
                    <p className="truncate font-medium">{productLabel(product)}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                      {[
                        size,
                        product?.wrapper,
                        humidorName.get(item.humidorId),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Pill tone="accent">{item.qty} in stock</Pill>
                      {rest.ready ? (
                        <Pill tone="ok">rested {humanDays(rest.ageDays)}</Pill>
                      ) : (
                        <Pill tone="warn">{rest.daysRemaining}d to go</Pill>
                      )}
                      {avg != null && <Pill>avg {Math.round(avg)}</Pill>}
                      {item.pricePerStick != null && (
                        <Pill>{money(item.pricePerStick)}</Pill>
                      )}
                    </div>
                  </Link>
                  <LinkButton href={`/log?item=${item.id}`} variant="ghost">
                    Smoke
                  </LinkButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
