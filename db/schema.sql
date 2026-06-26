-- ============================================================================
-- Trading Screener & Journal — Supabase schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ACCOUNT SETTINGS (single-row table: your global risk/account config)
-- ----------------------------------------------------------------------------
create table if not exists account_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_usd numeric not null default 150,        -- max trading allocation
  risk_min_pct numeric not null default 5,             -- min % of allocation risked per trade
  risk_max_pct numeric not null default 10,            -- max % of allocation risked per trade
  min_criteria_to_alert int not null default 3,        -- how many of the 4 criteria must hit before a Telegram alert fires
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. WATCHLIST / ASSET CONFIG — which symbols the scanner watches, and the
--    per-asset thresholds for each of the 4 criteria. Editable from the app.
-- ----------------------------------------------------------------------------
create table if not exists watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,                 -- e.g. 'SOLUSDT', 'BNBUSDT', 'HYPEUSDT'
  exchange text not null default 'binance_futures',
  entry_timeframe text not null default '1h',   -- timeframe the scanner evaluates for entries
  htf_timeframe text not null default '1d',     -- higher timeframe used for criterion 1 (trend alignment)
  is_active boolean not null default true,
  -- Criterion 1: HTF trend alignment
  htf_ema_fast int not null default 21,
  htf_ema_slow int not null default 50,
  -- Criterion 2: volume confirming momentum loss at a key level
  volume_lookback int not null default 20,
  volume_drop_pct numeric not null default 30,   -- volume must drop this % vs avg to count as "momentum loss"
  key_level_lookback int not null default 50,    -- bars used to detect swing high/low "key levels"
  -- Criterion 3: price action rejection / structure break
  rejection_wick_ratio numeric not null default 1.5, -- wick must be >= this multiple of the candle body
  -- Criterion 4: indicator confirmation (RSI divergence / extremes), confirming not leading
  rsi_period int not null default 14,
  rsi_overbought numeric not null default 70,
  rsi_oversold numeric not null default 30,
  created_at timestamptz not null default now(),
  unique(user_id, symbol)
);

-- ----------------------------------------------------------------------------
-- 3. SIGNALS — every scanner evaluation gets logged here, scored 0-4.
--    Alerts are only sent when score >= min_criteria_to_alert, but every
--    pass is stored so you can review screener behaviour / tune thresholds.
-- ----------------------------------------------------------------------------
create table if not exists signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  score int not null,                      -- how many of the 4 criteria were met (0-4)
  c1_htf_trend boolean not null default false,
  c2_volume_momentum_loss boolean not null default false,
  c3_price_action boolean not null default false,
  c4_indicator_confirm boolean not null default false,
  details jsonb not null default '{}',     -- raw numbers behind each criterion, for transparency/debugging
  price_at_signal numeric,
  suggested_entry_low numeric,
  suggested_entry_high numeric,
  suggested_stop numeric,
  suggested_tp numeric,
  alert_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_signals_user_created on signals (user_id, created_at desc);
create index if not exists idx_signals_symbol on signals (symbol, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. TRADES — your actual journal. Can be created manually from the app, or
--    pre-filled by clicking "log this" on a signal.
-- ----------------------------------------------------------------------------
create table if not exists trades (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_id uuid references signals(id) on delete set null,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  criteria_met int,                       -- snapshot of how many criteria were met at entry
  c1 boolean, c2 boolean, c3 boolean, c4 boolean,
  entry_price numeric,
  stop_price numeric,
  take_profit_price numeric,
  position_size_usd numeric,
  risk_usd numeric,
  risk_pct numeric,
  exit_price numeric,
  pnl_usd numeric,
  pnl_pct numeric,
  rr_planned numeric,                     -- planned reward:risk at entry
  rr_actual numeric,                      -- realised reward:risk at exit
  notes text,
  screenshot_url text,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trades_user_status on trades (user_id, status);
create index if not exists idx_trades_opened on trades (user_id, opened_at desc);

-- ----------------------------------------------------------------------------
-- 5. EQUITY SNAPSHOTS — for the performance/equity curve chart
-- ----------------------------------------------------------------------------
create table if not exists equity_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equity_usd numeric not null,
  snapshot_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security — every table is scoped to auth.uid() so only you
-- (logged into the web app) can read/write your own rows. The scanner uses
-- the Supabase service_role key, which bypasses RLS entirely.
-- ----------------------------------------------------------------------------
alter table account_settings enable row level security;
alter table watchlist enable row level security;
alter table signals enable row level security;
alter table trades enable row level security;
alter table equity_snapshots enable row level security;

create policy "owner can manage own settings" on account_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can manage own watchlist" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can manage own signals" on signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can manage own trades" on trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can manage own equity" on equity_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Seed default watchlist + settings after you sign up — run this manually
-- once, replacing YOUR_USER_ID with your auth.users.id (find it in
-- Authentication > Users in the Supabase dashboard after your first signup).
-- ----------------------------------------------------------------------------
-- insert into account_settings (user_id) values ('YOUR_USER_ID');
-- insert into watchlist (user_id, symbol) values
--   ('YOUR_USER_ID', 'SOLUSDT'),
--   ('YOUR_USER_ID', 'BNBUSDT'),
--   ('YOUR_USER_ID', 'HYPEUSDT');
