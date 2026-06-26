"""
Scanner entrypoint -- run this on the Raspberry Pi.

Every SCAN_INTERVAL_MINUTES it:
  1. Loads your watchlist + account settings from Supabase
  2. Pulls HTF (daily) + entry-timeframe candles for each symbol
  3. Scores the 4 criteria for both long and short reversal scenarios
  4. Logs every evaluation to `signals` (even sub-threshold ones)
  5. Sends a Telegram alert + position sizing when score >= min_criteria_to_alert,
     and avoids re-alerting the same setup within a cooldown window
"""
import os
import logging
import traceback
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler

from app.data import fetch_klines
from app.criteria import CriteriaConfig, evaluate
from app.sizing import position_size
from app.notify import send_telegram, format_alert
from app import db as dbmod

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("scanner")

ALERT_COOLDOWN_MINUTES = 240  # don't re-alert the same symbol+direction within 4h


def cfg_from_watchlist_row(row: dict) -> CriteriaConfig:
    return CriteriaConfig(
        htf_ema_fast=row.get("htf_ema_fast", 21),
        htf_ema_slow=row.get("htf_ema_slow", 50),
        volume_lookback=row.get("volume_lookback", 20),
        volume_drop_pct=row.get("volume_drop_pct", 30),
        key_level_lookback=row.get("key_level_lookback", 50),
        rejection_wick_ratio=row.get("rejection_wick_ratio", 1.5),
        rsi_period=row.get("rsi_period", 14),
        rsi_overbought=row.get("rsi_overbought", 70),
        rsi_oversold=row.get("rsi_oversold", 30),
    )


def run_scan_cycle():
    user_id = os.environ["SUPABASE_USER_ID"]
    client = dbmod.get_client()
    settings = dbmod.get_account_settings(client, user_id)
    watchlist = dbmod.get_active_watchlist(client, user_id)

    if not watchlist:
        log.warning("Watchlist is empty -- add symbols in the web app (Settings page) or via the seed SQL.")
        return

    min_criteria = settings.get("min_criteria_to_alert", 3)
    allocation = float(settings.get("allocation_usd", 150))
    risk_pct = float(settings.get("risk_max_pct", 10))  # use the upper bound of your 5-10% range

    for row in watchlist:
        symbol = row["symbol"]
        try:
            cfg = cfg_from_watchlist_row(row)
            df_htf = fetch_klines(symbol, row.get("htf_timeframe", "1d"), limit=200)
            df_entry = fetch_klines(symbol, row.get("entry_timeframe", "1h"), limit=300)

            results = evaluate(df_htf, df_entry, cfg)

            for result in results:
                should_alert = result.score >= min_criteria
                if should_alert:
                    recent = dbmod.get_recent_signal(client, user_id, symbol, result.direction)
                    if recent:
                        last_time = datetime.fromisoformat(recent["created_at"].replace("Z", "+00:00"))
                        if datetime.now(timezone.utc) - last_time < timedelta(minutes=ALERT_COOLDOWN_MINUTES):
                            should_alert = False  # cooldown active, log only, don't re-alert

                dbmod.insert_signal(client, user_id, symbol, result, alert_sent=should_alert)

                if should_alert:
                    sizing = position_size(
                        entry=(result.suggested_entry_low + result.suggested_entry_high) / 2,
                        stop=result.suggested_stop,
                        allocation_usd=allocation,
                        risk_pct=risk_pct,
                    )
                    msg = format_alert(symbol, result, sizing, min_criteria)
                    send_telegram(msg)
                    log.info(f"ALERT sent: {symbol} {result.direction} score={result.score}/4")
                else:
                    log.info(f"{symbol} {result.direction} score={result.score}/4 (no alert)")

        except Exception as e:
            log.error(f"Error scanning {symbol}: {e}\n{traceback.format_exc()}")


def main():
    interval = int(os.environ.get("SCAN_INTERVAL_MINUTES", 15))
    log.info(f"Starting scanner. Interval: {interval} minutes.")
    run_scan_cycle()  # run once immediately on startup
    scheduler = BlockingScheduler()
    scheduler.add_job(run_scan_cycle, "interval", minutes=interval)
    scheduler.start()


if __name__ == "__main__":
    main()
