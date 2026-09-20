# Humidor

A cigar tracker built around one question the commercial apps don't answer:
**does this cigar actually get better with age?**

Because reviews attach to the *blend* rather than to a purchase, every stick you
smoke from the same box over two years lands on one rating history. The app fits
a trend line through those scores against how long the cigar had rested, and
tells you whether the improvement is real or whether you're reading noise.

It's a local-first PWA. Everything lives in your browser, it works with no
signal, and it needs no account to be useful.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional - see "Keys" below
npm run dev
```

Open http://localhost:3000. On a phone, use **Add to Home Screen** and it runs
like an app, offline included.

## Keys

Both are optional, and both stay server-side — they are read only inside
`/api` route handlers and never shipped to the browser.

| Variable | Enables | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Band-photo identification | The scan screen opens a blank form instead of a prefilled one |
| `GOVEE_API_KEY` | Pulling humidity from a Govee sensor | Manual RH entry, which works fine |

### About the Govee integration

Only **WiFi and gateway-backed** Govee sensors report to Govee's cloud. A
Bluetooth-only unit (H5075, H5074, a standalone H5100) never will, regardless of
your API key — the data simply never leaves the sensor. Options there: add a
Govee gateway, or log readings by hand.

Because SKUs report their capabilities differently, `src/lib/govee.ts` walks the
response looking for humidity and temperature rather than assuming a fixed
shape, and normalizes Celsius to Fahrenheit by range. **This is the one piece
not verified against live hardware** — if your device returns something
unexpected, `extractReading` is where to look.

## What's in it

- **Inventory** — per humidor, with purchase price, vendor, box code and quantity
- **Rest tracking** — cigars need weeks to settle after shipping; the app holds
  them back until they're ready and shows the countdown
- **Reviews** — six weighted sub-scores to a 0–100 composite, a flavor wheel, and
  notes per third
- **Aging analysis** — score vs. rest time per blend, with a correlation check so
  a flat scatter gets labeled "no clear trend" instead of dressed up as a finding
- **Humidor health** — RH drift against your target band, plus a temperature
  warning at 73°F where tobacco beetles become a risk
- **Value and habits** — score per dollar, burn rate, how many weeks of stock is left
- **Band scanning** — photograph a band, get brand/line/vitola back, confirm and save
- **Export / import** — your data as a JSON file you own

## How scoring works

`src/lib/scoring.ts`. Six sub-scores, 0–10, weighted to a 0–100 composite:

| | Weight |
|---|---|
| Flavor | 30% |
| Complexity | 20% |
| Construction | 15% |
| Draw | 15% |
| Appearance | 10% |
| Burn & ash | 10% |

**Value is tracked but deliberately excluded from the composite.** Price is a
property of a purchase, not of the blend — folding it in would make the same
cigar score differently depending on where you bought it. It drives the
score-per-dollar ranking instead.

## Architecture

```
src/lib/          domain model, local database, scoring, analytics
src/app/api/      server-only routes (Claude vision, Govee proxy)
src/app/          pages - dashboard, inventory, scan, log, humidors, stats
src/components/   UI primitives and charts
supabase/         Phase 2 schema (not needed to run the app)
```

Data lives in IndexedDB via Dexie. `src/lib/db.ts` mirrors
`supabase/migrations/0001_init.sql` field for field.

## Phase 2: multi-device sync

The app is complete without this. Add it when you want the same collection on
your phone and laptop.

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty)
2. `supabase db push` to apply `supabase/migrations/0001_init.sql`
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`

The schema has row-level security on every table from the start, so it's safe to
add a second user later without reworking it. It also ships a
`product_aging_trend` view that computes the same regression as the client, in
SQL.

> The anon key is safe to commit — RLS is what protects the data. **Never put
> the service-role key in this app**; it bypasses every policy.

## Deploying

Vercel's free tier covers this. Push the repo, import it, set `ANTHROPIC_API_KEY`
and `GOVEE_API_KEY` in project settings. The two `/api` routes need a server, so
don't export it as a static site.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the build
npm run lint     # eslint
node scripts/make-icons.mjs   # regenerate PWA icons
```

## Known gaps

- **Govee response parsing is unverified against live hardware** (see above).
- Editing a cigar after saving isn't built yet — you can add and log, not amend.
- No background alerts. A local-first PWA has no server to run a cron, so RH
  warnings appear when you open the app. Background push needs Phase 2.
- Photos are stored as downscaled data URLs in IndexedDB. Fine for hundreds of
  cigars; move them to Supabase Storage if you get to thousands.
