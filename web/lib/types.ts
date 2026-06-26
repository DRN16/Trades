export type Signal = {
  id: string;
  symbol: string;
  direction: "long" | "short";
  score: number;
  c1_htf_trend: boolean;
  c2_volume_momentum_loss: boolean;
  c3_price_action: boolean;
  c4_indicator_confirm: boolean;
  details: Record<string, unknown>;
  price_at_signal: number | null;
  suggested_entry_low: number | null;
  suggested_entry_high: number | null;
  suggested_stop: number | null;
  suggested_tp: number | null;
  alert_sent: boolean;
  created_at: string;
};

export type Trade = {
  id: string;
  signal_id: string | null;
  symbol: string;
  direction: "long" | "short";
  status: "open" | "closed" | "cancelled";
  criteria_met: number | null;
  c1: boolean | null;
  c2: boolean | null;
  c3: boolean | null;
  c4: boolean | null;
  entry_price: number | null;
  stop_price: number | null;
  take_profit_price: number | null;
  position_size_usd: number | null;
  risk_usd: number | null;
  risk_pct: number | null;
  exit_price: number | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
  rr_planned: number | null;
  rr_actual: number | null;
  notes: string | null;
  screenshot_url: string | null;
  opened_at: string | null;
  closed_at: string | null;
};

export type Watchlist = {
  id: string;
  symbol: string;
  exchange: string;
  entry_timeframe: string;
  htf_timeframe: string;
  is_active: boolean;
  htf_ema_fast: number;
  htf_ema_slow: number;
  volume_lookback: number;
  volume_drop_pct: number;
  key_level_lookback: number;
  rejection_wick_ratio: number;
  rsi_period: number;
  rsi_overbought: number;
  rsi_oversold: number;
};

export type AccountSettings = {
  id: string;
  allocation_usd: number;
  risk_min_pct: number;
  risk_max_pct: number;
  min_criteria_to_alert: number;
};
