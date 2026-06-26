# Trading Screener & Journal

A personal reversal-trading screener and journal for crypto futures (SOL/BNB/HYPE by default), built around a 4-criteria momentum-loss reversal framework:

1. **HTF trend aligned** — daily/weekly EMA trend matches the reversal direction
2. **Volume confirming momentum loss** — volume drops off as price reaches a key swing level
3. **Price action: rejection or structure break** — a rejection wick or a failed breakout/breakdown at that level
4. **Indicator confirming, not leading** — RSI at an extreme *and* diverging from price, used to confirm rather than trigger

A setup needs 3 of these 4 (configurable) before it counts. When it does, you get a Telegram alert with a suggested entry zone, stop, take-profit (next key structure level), and a position size based on your $150 allocation and 5–10% risk-per-trade rule.

## Structure

```
db/         Supabase SQL schema (run once)
scanner/    Python service — runs on your Raspberry Pi, scores the market, sends Telegram alerts
web/        Next.js app — dashboard/journal, deployed free on Vercel, works on PC and phone
docker-compose.yml   Runs the scanner on the Pi
DEPLOY.md   Full step-by-step setup
```

## Quick start

Read `DEPLOY.md` top to bottom — it walks through Supabase, Vercel, Telegram, and the Pi in order. Each step depends on the one before it, so don't skip ahead.

## How the four pages work

- **Screener** (`/dashboard`) — every signal the scanner has evaluated, newest first, with a per-criterion breakdown and a "log this as a trade" button for anything scoring 3/4 or higher. Updates live as the scanner writes new rows.
- **Journal** (`/journal`) — your trade log: open/closed trades, P&L, win rate, equity curve. Add trades manually or promote them from a screener signal.
- **Settings** (`/settings`) — your allocation, risk %, alert threshold, and per-symbol criteria thresholds (volume drop %, rejection wick ratio, RSI levels, lookback windows, timeframes). The scanner picks up changes on its next cycle, no redeploy needed.

## Customizing the rules

Everything that defines "what counts" as each criterion lives in two places:
- **Per-symbol thresholds** — editable live from the Settings page (no code changes).
- **The scoring logic itself** — `scanner/app/criteria.py`, if you want to change *how* a criterion is detected (e.g. add MACD divergence alongside RSI, or change what counts as a "key level").

## Adding more symbols or a different exchange

Add a row to the `watchlist` table (or click "+ Add" in Settings) for any symbol your data source lists. If you want a different exchange than Binance Futures (e.g. for HYPE), swap the implementation in `scanner/app/data.py` — everything downstream just expects a DataFrame with `open/high/low/close/volume` columns, so it doesn't need to change.
