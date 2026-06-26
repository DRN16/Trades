"""
The 4-criteria reversal scoring engine.

This encodes your rules:
  C1 - Higher timeframe trend aligned (daily/weekly): the reversal direction
       matches the dominant HTF trend (you're catching a pullback-reversal
       WITH the bigger trend, not guessing a counter-trend top/bottom).
  C2 - Volume confirming momentum loss at a key level: price is near a
       recent swing high/low and the volume pushing into that level has
       dropped off vs its recent average -- the move is running out of gas.
  C3 - Price action showing rejection or structure break: either a long
       rejection wick at the key level, or a break of minor swing structure
       in the reversal direction.
  C4 - Indicator confirming, NOT leading: RSI is at an extreme AND showing
       divergence against price (price still pushing but RSI isn't) --
       confirmation after the fact, never used as the sole trigger.

A signal needs >= min_criteria (default 3 of 4) to be alert-worthy. Every
evaluation is still scored and stored so you can see near-misses.
"""
from dataclasses import dataclass, field
import pandas as pd
from .indicators import ema, rsi, swing_levels, near_level


@dataclass
class CriteriaConfig:
    htf_ema_fast: int = 21
    htf_ema_slow: int = 50
    volume_lookback: int = 20
    volume_drop_pct: float = 30.0
    key_level_lookback: int = 50
    level_tolerance_pct: float = 1.0
    rejection_wick_ratio: float = 1.5
    rsi_period: int = 14
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0


@dataclass
class SignalResult:
    direction: str
    score: int
    c1_htf_trend: bool
    c2_volume_momentum_loss: bool
    c3_price_action: bool
    c4_indicator_confirm: bool
    details: dict = field(default_factory=dict)
    price: float = 0.0
    suggested_entry_low: float = None
    suggested_entry_high: float = None
    suggested_stop: float = None
    suggested_tp: float = None


def _htf_trend_direction(df_htf: pd.DataFrame, cfg: CriteriaConfig) -> str:
    fast = ema(df_htf["close"], cfg.htf_ema_fast).iloc[-1]
    slow = ema(df_htf["close"], cfg.htf_ema_slow).iloc[-1]
    if fast > slow:
        return "up"
    if fast < slow:
        return "down"
    return "flat"


def _volume_momentum_loss(df: pd.DataFrame, cfg: CriteriaConfig) -> tuple[bool, dict]:
    avg_vol = df["volume"].rolling(cfg.volume_lookback).mean().iloc[-2]  # exclude current forming bar
    recent_vol = df["volume"].iloc[-2]
    if avg_vol == 0 or pd.isna(avg_vol):
        return False, {"avg_vol": avg_vol, "recent_vol": recent_vol}
    drop_pct = (avg_vol - recent_vol) / avg_vol * 100
    met = drop_pct >= cfg.volume_drop_pct
    return met, {"avg_vol": round(avg_vol, 2), "recent_vol": round(recent_vol, 2), "drop_pct": round(drop_pct, 1)}


def _price_action_signal(df: pd.DataFrame, cfg: CriteriaConfig, level: float, direction: str) -> tuple[bool, dict]:
    last = df.iloc[-2]  # last fully closed candle
    body = abs(last["close"] - last["open"])
    upper_wick = last["high"] - max(last["close"], last["open"])
    lower_wick = min(last["close"], last["open"]) - last["low"]
    body = max(body, 1e-9)

    rejection = False
    if direction == "short" and upper_wick / body >= cfg.rejection_wick_ratio:
        rejection = True
    if direction == "long" and lower_wick / body >= cfg.rejection_wick_ratio:
        rejection = True

    # minor structure break: did the prior swing get broken then reclaimed (short)
    # or broken then reclaimed to the downside undone (long)?
    prior_window = df.iloc[-(cfg.key_level_lookback + 1):-2]
    structure_break = False
    if direction == "short" and last["high"] > prior_window["high"].max() and last["close"] < prior_window["high"].max():
        structure_break = True  # false breakout above resistance, closed back below
    if direction == "long" and last["low"] < prior_window["low"].min() and last["close"] > prior_window["low"].min():
        structure_break = True  # false breakdown below support, closed back above

    met = rejection or structure_break
    return met, {
        "rejection_wick": rejection,
        "structure_break": structure_break,
        "upper_wick_to_body": round(upper_wick / body, 2),
        "lower_wick_to_body": round(lower_wick / body, 2),
    }


def _indicator_confirm(df: pd.DataFrame, cfg: CriteriaConfig, direction: str) -> tuple[bool, dict]:
    rsi_series = rsi(df["close"], cfg.rsi_period)
    last_rsi = rsi_series.iloc[-2]
    prev_rsi = rsi_series.iloc[-6] if len(rsi_series) > 6 else rsi_series.iloc[0]
    last_price = df["close"].iloc[-2]
    prev_price = df["close"].iloc[-6] if len(df) > 6 else df["close"].iloc[0]

    extreme = False
    divergence = False
    if direction == "short":
        extreme = last_rsi >= cfg.rsi_overbought - 5  # near/at overbought
        # bearish divergence: price higher, RSI lower (momentum already fading)
        divergence = last_price > prev_price and last_rsi < prev_rsi
    else:
        extreme = last_rsi <= cfg.rsi_oversold + 5
        divergence = last_price < prev_price and last_rsi > prev_rsi

    met = extreme and divergence
    return met, {"rsi": round(last_rsi, 1), "prev_rsi": round(prev_rsi, 1), "extreme": extreme, "divergence": divergence}


def evaluate(df_htf: pd.DataFrame, df_entry: pd.DataFrame, cfg: CriteriaConfig) -> list[SignalResult]:
    """Evaluate both long and short reversal scenarios on the entry timeframe,
    return both SignalResults (caller decides which, if any, clears the bar)."""
    htf_dir = _htf_trend_direction(df_htf, cfg)
    swing_high, swing_low = swing_levels(df_entry, cfg.key_level_lookback)
    last_price = float(df_entry["close"].iloc[-2])

    results = []
    for direction, level in (("short", swing_high), ("long", swing_low)):
        c1 = (direction == "long" and htf_dir == "up") or (direction == "short" and htf_dir == "down")
        near = near_level(last_price, level, cfg.level_tolerance_pct)
        c2, c2_details = _volume_momentum_loss(df_entry, cfg) if near else (False, {"reason": "not near key level"})
        c3, c3_details = _price_action_signal(df_entry, cfg, level, direction)
        c4, c4_details = _indicator_confirm(df_entry, cfg, direction)

        score = sum([c1, c2 and near, c3, c4])

        # Suggested levels: entry near the key level, stop just beyond it,
        # TP at the opposite recent swing (next key structure level).
        buffer = abs(swing_high - swing_low) * 0.05
        if direction == "short":
            entry_low, entry_high = level - buffer, level + buffer
            stop = level + buffer * 2
            tp = swing_low
        else:
            entry_low, entry_high = level - buffer, level + buffer
            stop = level - buffer * 2
            tp = swing_high

        results.append(SignalResult(
            direction=direction,
            score=score,
            c1_htf_trend=c1,
            c2_volume_momentum_loss=bool(c2 and near),
            c3_price_action=c3,
            c4_indicator_confirm=c4,
            details={
                "htf_trend": htf_dir,
                "key_level": round(level, 4),
                "near_key_level": near,
                "volume": c2_details,
                "price_action": c3_details,
                "indicator": c4_details,
            },
            price=last_price,
            suggested_entry_low=round(entry_low, 4),
            suggested_entry_high=round(entry_high, 4),
            suggested_stop=round(stop, 4),
            suggested_tp=round(tp, 4),
        ))
    return results
