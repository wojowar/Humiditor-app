"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import {
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Pill,
  SectionTitle,
  Stat,
} from "@/components/ui";
import {
  useHumidors,
  useInventory,
  useProductMap,
  useReadings,
  useReviews,
  useSessions,
  productLabel,
} from "@/lib/hooks";
import { burnRate, collectionStats } from "@/lib/analytics";
import { humidorHealth, restState } from "@/lib/rest";
import { humanDays, money, shortDate } from "@/lib/format";
import { scoreBand } from "@/lib/scoring";

export default function DashboardPage() {
  const inventory = useInventory();
  const humidors = useHumidors();
  const readings = useReadings();
  const sessions = useSessions();
  const reviews = useReviews();
  const productMap = useProductMap();

  const stats = collectionStats(inventory);
  const rate = burnRate(sessions, stats.totalSticks);

  // "What can I actually smoke tonight" - rested, in stock, best rated first.
  const reviewByProduct = new Map<string, number>();
  for (const r of reviews) {
    const prev = reviewByProduct.get(r.productId);
    reviewByProduct.set(
      r.productId,
      prev == null ? r.overall : (prev + r.overall) / 2,
    );
  }

  const readyNow = inventory
    .filter((i) => i.qty > 0 && restState(i).ready)
    .sort(
      (a, b) =>
        (reviewByProduct.get(b.productId) ?? 0) -
        (reviewByProduct.get(a.productId) ?? 0),
    )
    .slice(0, 5);

  const restingSoon = inventory
    .filter((i) => i.qty > 0 && !restState(i).ready)
    .sort((a, b) => restState(a).daysRemaining - restState(b).daysRemaining)
    .slice(0, 3);

  const attention = humidors
    .map((h) => ({
      humidor: h,
      health: humidorHealth(
        h,
        readings.filter((r) => r.humidorId === h.id),
      ),
    }))
    .filter((x) => x.health.level !== "ok");

  const recent = sessions.slice(0, 3);
  const reviewBySession = new Map(reviews.map((r) => [r.sessionId, r]));

  const empty = inventory.length === 0 && sessions.length === 0;

  return (
    <>
      <PageHeader
        title="Humidor"
        subtitle={
          empty
            ? "Let's get your collection in."
            : `${stats.totalSticks} sticks across ${stats.distinctProducts} cigars`
        }
        action={
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-full border p-2"
            style={{ background: "var(--surface-2)", color: "var(--muted)" }}
          >
            <Settings2 size={18} aria-hidden />
          </Link>
        }
      />

      {empty ? (
        <Empty
          title="Nothing in the humidor yet"
          body="Point your camera at a cigar band and the app will read the brand, line and size off it. Faster than typing, especially for a big collection."
          action={<LinkButton href="/scan">Scan a band</LinkButton>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="In stock" value={stats.totalSticks} sub={`${stats.readySticks} ready`} />
            <Stat label="Resting" value={stats.restingSticks} sub="not yet settled" />
            <Stat
              label="Collection value"
              value={money(stats.collectionValue)}
              sub={stats.avgCostPerStick ? `${money(stats.avgCostPerStick)} avg` : undefined}
            />
            <Stat
              label="Burn rate"
              value={rate.perWeek ? `${rate.perWeek.toFixed(1)}/wk` : "--"}
              sub={
                rate.weeksOfStockLeft != null
                  ? `~${Math.round(rate.weeksOfStockLeft)} wks of stock`
                  : "no recent sessions"
              }
            />
          </div>

          {attention.length > 0 && (
            <>
              <SectionTitle>Needs attention</SectionTitle>
              <div className="space-y-2">
                {attention.map(({ humidor, health }) => (
                  <Link key={humidor.id} href="/humidors" className="block">
                    <Card>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{humidor.name}</span>
                        <Pill tone={health.level === "danger" ? "danger" : "warn"}>
                          {health.level === "danger" ? "Action needed" : "Check"}
                        </Pill>
                      </div>
                      <ul className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                        {health.messages.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}

          <SectionTitle>Ready to smoke</SectionTitle>
          {readyNow.length === 0 ? (
            <Card>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Everything in stock is still resting. Give it time.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {readyNow.map((item) => {
                const product = productMap.get(item.productId);
                const rest = restState(item);
                const avg = reviewByProduct.get(item.productId);
                return (
                  <Card key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{productLabel(product)}</p>
                        <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                          {item.qty} left &middot; rested {humanDays(rest.ageDays)}
                          {avg ? ` · avg ${Math.round(avg)}` : ""}
                        </p>
                      </div>
                      <LinkButton href={`/log?item=${item.id}`} variant="ghost">
                        Smoke
                      </LinkButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {restingSoon.length > 0 && (
            <>
              <SectionTitle>Resting</SectionTitle>
              <div className="space-y-2">
                {restingSoon.map((item) => {
                  const rest = restState(item);
                  return (
                    <Card key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm">
                          {productLabel(productMap.get(item.productId))}
                        </span>
                        <span
                          className="shrink-0 text-xs tabular-nums"
                          style={{ color: "var(--muted)" }}
                        >
                          {rest.daysRemaining}d left
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(rest.progress * 100)}%`,
                            background: "var(--accent)",
                          }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {recent.length > 0 && (
            <>
              <SectionTitle>Recently smoked</SectionTitle>
              <div className="space-y-2">
                {recent.map((session) => {
                  const review = reviewBySession.get(session.id);
                  return (
                    <Card key={session.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {productLabel(productMap.get(session.productId))}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {shortDate(session.smokedAt)}
                            {session.pairing ? ` · ${session.pairing}` : ""}
                          </p>
                        </div>
                        {review && (
                          <div className="shrink-0 text-right">
                            <div className="text-lg font-semibold tabular-nums">
                              {review.overall}
                            </div>
                            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                              {scoreBand(review.overall).label}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
