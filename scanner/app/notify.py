"""Telegram alert formatting and sending."""
import os
import requests


def send_telegram(text: str):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    resp = requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def format_alert(symbol: str, result, sizing: dict, min_criteria: int) -> str:
    criteria_lines = [
        ("HTF trend aligned (daily/weekly)", result.c1_htf_trend),
        ("Volume confirming momentum loss at key level", result.c2_volume_momentum_loss),
        ("Price action: rejection / structure break", result.c3_price_action),
        ("Indicator confirming (RSI, not leading)", result.c4_indicator_confirm),
    ]
    met = sum(1 for _, ok in criteria_lines if ok)
    lines_txt = "\n".join(f"  {'✅' if ok else '❌'} {label}" for label, ok in criteria_lines)

    direction_label = "LONG (reversal up)" if result.direction == "long" else "SHORT (reversal down)"

    msg = (
        f"*{symbol} — {met}/4 criteria met* (alert threshold: {min_criteria})\n"
        f"Direction: *{direction_label}*\n"
        f"Price: {result.price}\n\n"
        f"{lines_txt}\n\n"
        f"*Suggested entry zone:* {result.suggested_entry_low} – {result.suggested_entry_high}\n"
        f"*Stop loss:* {result.suggested_stop}\n"
        f"*Take profit (next key level):* {result.suggested_tp}\n\n"
        f"*Sizing @ ${sizing.get('risk_usd', '?')} risk:*\n"
        f"  Position size: ~${sizing.get('position_size_usd', '?')}\n"
        f"  Implied leverage: ~{sizing.get('implied_leverage', '?')}x\n"
        f"  Stop distance: {sizing.get('stop_distance_pct', '?')}%\n\n"
        f"_This is {met}/4 of your criteria — review the chart yourself before entering. "
        f"Open the app to log this trade._"
    )
    return msg
