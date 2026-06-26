"""
Market data fetching.

Default source: Binance USDT-M Futures public REST API (no API key needed
for klines). If a symbol isn't listed there (this can happen with newer
listings like HYPE depending on your region/exchange), the fetch simply
fails for that symbol and the scanner logs a warning and skips it that
cycle -- it will keep retrying on the next scan.
"""
import requests
import pandas as pd

BINANCE_FAPI = "https://fapi.binance.com/fapi/v1/klines"

# Map our own generic timeframe names to Binance interval strings
TIMEFRAME_MAP = {
    "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w", "15m": "15m", "5m": "5m",
}


def fetch_klines(symbol: str, timeframe: str, limit: int = 300) -> pd.DataFrame:
    """Fetch OHLCV candles and return as a DataFrame, oldest first."""
    interval = TIMEFRAME_MAP.get(timeframe, timeframe)
    params = {"symbol": symbol.upper(), "interval": interval, "limit": limit}
    resp = requests.get(BINANCE_FAPI, params=params, timeout=15)
    resp.raise_for_status()
    raw = resp.json()
    cols = [
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_base", "taker_quote", "ignore",
    ]
    df = pd.DataFrame(raw, columns=cols)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    return df[["open_time", "open", "high", "low", "close", "volume"]]
