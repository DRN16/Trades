"""Lightweight technical indicator helpers -- no TA-Lib dependency needed."""
import pandas as pd
import numpy as np


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return out.fillna(50)


def swing_levels(df: pd.DataFrame, lookback: int = 50):
    """Return (recent_swing_high, recent_swing_low) over the lookback window,
    excluding the most recent bar (so 'key level' isn't just current price)."""
    window = df.iloc[-(lookback + 1):-1]
    return float(window["high"].max()), float(window["low"].min())


def near_level(price: float, level: float, tolerance_pct: float = 1.0) -> bool:
    return abs(price - level) / level * 100 <= tolerance_pct
