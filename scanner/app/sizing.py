"""Position sizing helper -- turns a signal + your account settings into a
concrete $ position size and contract-ish numbers, based on your $150 max
allocation and 5-10% risk-per-trade rule."""


def position_size(entry: float, stop: float, allocation_usd: float, risk_pct: float):
    """Risk-based sizing: risk_usd = allocation * risk_pct. Position size is
    derived from how far the stop is from entry, then capped so it never
    exceeds the full allocation (relevant on lower-leverage/spot-like sizing)."""
    risk_usd = allocation_usd * (risk_pct / 100)
    stop_distance_pct = abs(entry - stop) / entry
    if stop_distance_pct == 0:
        return {"risk_usd": risk_usd, "position_size_usd": 0, "implied_leverage": 0}

    position_size_usd = risk_usd / stop_distance_pct
    position_size_usd = min(position_size_usd, allocation_usd * 5)  # sanity cap at 5x allocation
    implied_leverage = position_size_usd / allocation_usd

    return {
        "risk_usd": round(risk_usd, 2),
        "position_size_usd": round(position_size_usd, 2),
        "implied_leverage": round(implied_leverage, 2),
        "stop_distance_pct": round(stop_distance_pct * 100, 2),
    }
