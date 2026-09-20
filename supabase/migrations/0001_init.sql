-- Humidor schema (Phase 2).
--
-- The app is local-first and needs none of this to run. Apply it when you want
-- the same data on more than one device. The tables mirror src/lib/types.ts
-- field for field, so syncing is a transport change rather than a rewrite.
--
-- Every table is owned by a user and protected by row-level security, so this
-- is safe to point a second person at later without reworking it.

create extension if not exists "pgcrypto";

create table humidors (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  kind                text not null default 'Desktop',
  capacity            integer not null default 0 check (capacity >= 0),
  target_rh           numeric(4, 1) not null default 68 check (target_rh between 0 and 100),
  tolerance_rh        numeric(4, 1) not null default 3 check (tolerance_rh >= 0),
  target_temp_f       numeric(4, 1) not null default 68,
  seasoned_on         date,
  media_changed_on    date,
  media_interval_days integer not null default 90 check (media_interval_days > 0),
  govee_device_id     text,
  govee_model         text,
  notes               text,
  created_at          timestamptz not null default now()
);

-- The blend, independent of any purchase. Reviews hang off this so a rating
-- history accumulates across every box you ever buy.
create table cigar_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  brand       text not null,
  line        text not null default '',
  vitola      text not null default '',
  length_in   numeric(4, 2) check (length_in is null or length_in > 0),
  ring_gauge  integer check (ring_gauge is null or ring_gauge > 0),
  wrapper     text,
  binder      text,
  filler      text,
  origin      text,
  strength    text,
  msrp        numeric(10, 2) check (msrp is null or msrp >= 0),
  photo_url   text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  -- One row per blend per user; the app dedupes on exactly this key.
  unique (user_id, brand, line, vitola)
);

create table inventory_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  product_id       uuid not null references cigar_products (id) on delete cascade,
  humidor_id       uuid not null references humidors (id) on delete cascade,
  qty              integer not null default 0 check (qty >= 0),
  qty_purchased    integer not null default 0 check (qty_purchased >= 0),
  acquired_on      date not null default current_date,
  price_per_stick  numeric(10, 2) check (price_per_stick is null or price_per_stick >= 0),
  vendor           text,
  box_code         text,
  rest_days        integer not null default 21 check (rest_days >= 0),
  notes            text,
  created_at       timestamptz not null default now()
);

create table smoke_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  product_id        uuid not null references cigar_products (id) on delete cascade,
  inventory_item_id uuid references inventory_items (id) on delete set null,
  smoked_at         date not null default current_date,
  duration_min      integer check (duration_min is null or duration_min >= 0),
  location          text,
  pairing           text,
  -- Snapshotted at smoke time. Inventory keeps ageing, so recomputing this
  -- later would misreport how old the cigar actually was when smoked.
  rested_days       integer check (rested_days is null or rested_days >= 0),
  notes             text,
  photo_url         text,
  created_at        timestamptz not null default now()
);

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  session_id   uuid not null references smoke_sessions (id) on delete cascade,
  product_id   uuid not null references cigar_products (id) on delete cascade,
  appearance   smallint not null check (appearance between 0 and 10),
  construction smallint not null check (construction between 0 and 10),
  draw         smallint not null check (draw between 0 and 10),
  burn         smallint not null check (burn between 0 and 10),
  flavor       smallint not null check (flavor between 0 and 10),
  complexity   smallint not null check (complexity between 0 and 10),
  value        smallint check (value between 0 and 10),
  overall      smallint not null check (overall between 0 and 100),
  would_rebuy  boolean,
  flavor_tags  text[] not null default '{}',
  first_third  text,
  second_third text,
  final_third  text,
  created_at   timestamptz not null default now(),
  unique (session_id)
);

create table readings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  humidor_id  uuid not null references humidors (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  rh          numeric(4, 1) not null check (rh between 0 and 100),
  temp_f      numeric(4, 1),
  source      text not null default 'manual' check (source in ('manual', 'govee'))
);

create table wishlist (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  brand        text not null,
  line         text,
  vitola       text,
  target_price numeric(10, 2),
  notes        text,
  created_at   timestamptz not null default now()
);

-- Indexes for the reads the app actually makes.
create index on inventory_items (user_id, humidor_id) where qty > 0;
create index on inventory_items (user_id, product_id);
create index on smoke_sessions (user_id, smoked_at desc);
create index on reviews (user_id, product_id);
create index on readings (humidor_id, recorded_at desc);

-- Row-level security: every table, owner-only, from the start.
do $$
declare t text;
begin
  foreach t in array array[
    'humidors', 'cigar_products', 'inventory_items',
    'smoke_sessions', 'reviews', 'readings', 'wishlist'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end $$;

-- The aging question, answered in SQL: score against rest time per blend.
-- regr_slope is per day, so x30 puts it in points per month.
create view product_aging_trend
with (security_invoker = true) as
select
  s.user_id,
  s.product_id,
  count(*)                                         as review_count,
  round(avg(r.overall), 1)                         as avg_overall,
  min(s.rested_days)                               as min_rested_days,
  max(s.rested_days)                               as max_rested_days,
  round((regr_slope(r.overall, s.rested_days) * 30)::numeric, 2)
                                                   as slope_per_month,
  round(corr(r.overall, s.rested_days)::numeric, 3) as correlation
from smoke_sessions s
join reviews r on r.session_id = s.id
where s.rested_days is not null
group by s.user_id, s.product_id
-- Fewer than three points, or no spread in age, says nothing about aging.
having count(*) >= 3 and count(distinct s.rested_days) >= 2;
