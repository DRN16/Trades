"""Supabase access for the scanner. Uses the service_role key, which bypasses
Row Level Security -- safe here because this code only ever runs on your own
Pi, never exposed to the internet."""
import os
from supabase import create_client, Client


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def get_account_settings(client: Client, user_id: str) -> dict:
    res = client.table("account_settings").select("*").eq("user_id", user_id).limit(1).execute()
    if res.data:
        return res.data[0]
    # sensible defaults if nothing configured yet in the app
    return {"allocation_usd": 150, "risk_min_pct": 5, "risk_max_pct": 10, "min_criteria_to_alert": 3}


def get_active_watchlist(client: Client, user_id: str) -> list[dict]:
    res = client.table("watchlist").select("*").eq("user_id", user_id).eq("is_active", True).execute()
    return res.data or []


def get_recent_signal(client: Client, user_id: str, symbol: str, direction: str, since_minutes: int = 240):
    """Avoid spamming repeat alerts for the same setup within a window."""
    res = (
        client.table("signals")
        .select("*")
        .eq("user_id", user_id)
        .eq("symbol", symbol)
        .eq("direction", direction)
        .eq("alert_sent", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def insert_signal(client: Client, user_id: str, symbol: str, result, alert_sent: bool) -> dict:
    row = {
        "user_id": user_id,
        "symbol": symbol,
        "direction": result.direction,
        "score": result.score,
        "c1_htf_trend": result.c1_htf_trend,
        "c2_volume_momentum_loss": result.c2_volume_momentum_loss,
        "c3_price_action": result.c3_price_action,
        "c4_indicator_confirm": result.c4_indicator_confirm,
        "details": result.details,
        "price_at_signal": result.price,
        "suggested_entry_low": result.suggested_entry_low,
        "suggested_entry_high": result.suggested_entry_high,
        "suggested_stop": result.suggested_stop,
        "suggested_tp": result.suggested_tp,
        "alert_sent": alert_sent,
    }
    res = client.table("signals").insert(row).execute()
    return res.data[0] if res.data else row
