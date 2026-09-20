"use client";

import { Card, Empty, LinkButton, PageHeader, Pill, SectionTitle } from "@/components/ui";
import { AgingChart } from "@/components/AgingChart";
import { BarList } from "@/components/BarList";
import {
  agingTrends,
  burnRate,
  collectionStats,
  flavorFrequency,
  productRatings,
  valuePicks,
} from "@/lib/analytics";
import {
  useInventory,
  useProducts,
  useReviews,
  useSessions,
  productLabel,
} from "@/lib/hooks";
import { money } from "@/lib/format";

export default function AnalyticsPage() {
  const products = useProducts();
  const reviews = useReviews();
  const sessions = useSessions();
  const inventory = useInventory();

  const stats = collectionStats(inventory);
  const rate = burnRate(sessions, stats.totalSticks);
  const ratings = productRatings(products, reviews, sessions);
  const trends = agingTrends(products, sessions, reviews);
  const value = valuePicks(ratings, inventory);
  const flavors = flavorFrequency(reviews);

  if (reviews.length === 0) {
    return (
      <>
        <PageHeader title="Stats" />
        <Empty
          title="Nothing to analyze yet"
          body="Log a few smokes with ratings and this fills in - what you rate highest, what your money buys, and whether rest time is actually helping."
          action={<LinkButton href="/log">Log a smoke</LinkButton>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Stats"
        subtitle={`${reviews.length} reviews across ${ratings.length} cigars`}
      />

      <SectionTitle>Does rest actually help?</SectionTitle>
      {trends.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            This needs at least three reviews of the same cigar smoked at
            different ages. Keep logging the ones you buy by the box and the
            answer shows up here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {trends.slice(0, 4).map((trend) => {
            const rising = trend.slopePerMonth > 0;
            // A weak correlation means the scatter isn't really about age, so
            // say so rather than dressing up noise as a finding.
            const weak = Math.abs(trend.correlation) < 0.4;
            return (
              <Card key={trend.product.id}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">
                    {productLabel(trend.product)}
                  </p>
                  <Pill tone={weak ? "neutral" : rising ? "ok" : "warn"}>
                    {weak
                      ? "no clear trend"
                      : `${rising ? "+" : ""}${trend.slopePerMonth.toFixed(1)}/mo`}
                  </Pill>
                </div>
                <AgingChart trend={trend} />
                <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                  {weak
                    ? `Scores range ${Math.round(trend.firstAvg)}-${Math.round(trend.lastAvg)} but don't track age closely (r=${trend.correlation.toFixed(2)}).`
                    : `Averaged ${Math.round(trend.firstAvg)} when young, ${Math.round(trend.lastAvg)} later (r=${trend.correlation.toFixed(2)}).`}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <SectionTitle>Your best rated</SectionTitle>
      <Card>
        <BarList
          items={ratings.slice(0, 8).map((r) => ({
            label: productLabel(r.product),
            value: r.avgOverall,
            sub: `${r.reviewCount} review${r.reviewCount === 1 ? "" : "s"} · best ${r.bestOverall}`,
          }))}
        />
      </Card>

      <SectionTitle>Best value</SectionTitle>
      <Card>
        <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
          Score per dollar actually paid.
        </p>
        <BarList
          items={value.slice(0, 6).map((v) => ({
            label: productLabel(v.product),
            value: v.pointsPerDollar,
            sub: `${Math.round(v.avgOverall)} at ${money(v.avgPrice)}`,
          }))}
          formatValue={(v) => v.toFixed(1)}
          emptyNote="Add prices to your purchases to see this."
        />
      </Card>

      <SectionTitle>What you taste</SectionTitle>
      <Card>
        <BarList
          items={flavors.map((f) => ({ label: f.tag, value: f.count }))}
          formatValue={(v) => `${Math.round(v)}x`}
          emptyNote="Tag some flavors while reviewing and your palate shows up here."
        />
      </Card>

      <SectionTitle>Habits</SectionTitle>
      <Card>
        <dl className="space-y-2 text-sm">
          <Row
            label="Smoking rate"
            value={rate.perWeek ? `${rate.perWeek.toFixed(1)} per week` : "--"}
          />
          <Row
            label="Stock runway"
            value={
              rate.weeksOfStockLeft != null
                ? `~${Math.round(rate.weeksOfStockLeft)} weeks`
                : "--"
            }
          />
          <Row label="Total smoked" value={`${sessions.length}`} />
          <Row
            label="Average score"
            value={`${Math.round(
              reviews.reduce((s, r) => s + r.overall, 0) / reviews.length,
            )}`}
          />
          <Row
            label="Would buy again"
            value={`${Math.round(
              (reviews.filter((r) => r.wouldRebuy).length / reviews.length) * 100,
            )}%`}
          />
        </dl>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
