"use client";
import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import CriteriaBadge from "@/components/CriteriaBadge";
import { supabase } from "@/lib/supabaseClient";
import type { Signal } from "@/lib/types";

function SignalCard({ signal, onLog }: { signal: Signal; onLog: (s: Signal) => void }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold">{signal.symbol}</span>{" "}
          <span className={signal.direction === "long" ? "text-good" : "text-bad"}>
            {signal.direction.toUpperCase()}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {signal.score}/4 · {new Date(signal.created_at).toLocaleString()}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <CriteriaBadge label="HTF trend" met={signal.c1_htf_trend} />
        <CriteriaBadge label="Volume / momentum loss" met={signal.c2_volume_momentum_loss} />
        <CriteriaBadge label="Price action" met={signal.c3_price_action} />
        <CriteriaBadge label="Indicator confirm" met={signal.c4_indicator_confirm} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-300 mb-3">
        <div>
          <div className="label">Price</div>
          {signal.price_at_signal}
        </div>
        <div>
          <div className="label">Entry zone</div>
          {signal.suggested_entry_low} – {signal.suggested_entry_high}
        </div>
        <div>
          <div className="label">Stop</div>
          {signal.suggested_stop}
        </div>
        <div>
          <div className="label">Take profit</div>
          {signal.suggested_tp}
        </div>
      </div>
      {signal.score >= 3 && (
        <button className="btn" onClick={() => onLog(signal)}>
          Log this as a trade
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMinScore, setFilterMinScore] = useState(0);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setSignals((data as Signal[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("signals-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function logAsTrade(signal: Signal) {
    const { error } = await supabase.from("trades").insert({
      signal_id: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      status: "open",
      criteria_met: signal.score,
      c1: signal.c1_htf_trend,
      c2: signal.c2_volume_momentum_loss,
      c3: signal.c3_price_action,
      c4: signal.c4_indicator_confirm,
      entry_price: signal.suggested_entry_low,
      stop_price: signal.suggested_stop,
      take_profit_price: signal.suggested_tp,
    });
    if (!error) window.location.href = "/journal";
  }

  const visible = signals.filter((s) => s.score >= filterMinScore);

  return (
    <AuthGate>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Live Screener</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Min score</span>
          <select
            className="input w-auto"
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}/4
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading && <p className="text-gray-400">Loading…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-gray-400">
          No signals yet at this score. The scanner on your Pi evaluates every watchlist symbol on its
          schedule — make sure it's running and your watchlist is configured in Settings.
        </p>
      )}
      <div className="space-y-3">
        {visible.map((s) => (
          <SignalCard key={s.id} signal={s} onLog={logAsTrade} />
        ))}
      </div>
    </AuthGate>
  );
}
