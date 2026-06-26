"use client";
import { useEffect, useMemo, useState } from "react";
import AuthGate, { useUserId } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import type { Trade } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const emptyForm: Partial<Trade> = {
  symbol: "SOLUSDT",
  direction: "long",
  status: "open",
  entry_price: undefined,
  stop_price: undefined,
  take_profit_price: undefined,
  position_size_usd: undefined,
  risk_usd: undefined,
  notes: "",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export default function JournalPage() {
  const userId = useUserId();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState<Partial<Trade>>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("trades").select("*").order("opened_at", { ascending: false });
    setTrades((data as Trade[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTrade() {
    if (!userId) return;
    await supabase.from("trades").insert({ ...form, user_id: userId });
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function closeTrade(trade: Trade, exitPrice: number) {
    const direction = trade.direction === "long" ? 1 : -1;
    const entry = trade.entry_price ?? 0;
    const size = trade.position_size_usd ?? 0;
    const pnlPct = entry ? ((exitPrice - entry) / entry) * 100 * direction : 0;
    const pnlUsd = size * (pnlPct / 100);
    await supabase
      .from("trades")
      .update({
        status: "closed",
        exit_price: exitPrice,
        pnl_pct: pnlPct,
        pnl_usd: pnlUsd,
        closed_at: new Date().toISOString(),
      })
      .eq("id", trade.id);
    load();
  }

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === "closed");
    const wins = closed.filter((t) => (t.pnl_usd ?? 0) > 0);
    const totalPnl = closed.reduce((sum, t) => sum + (t.pnl_usd ?? 0), 0);
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    return { totalPnl, winRate, closedCount: closed.length, openCount: trades.filter((t) => t.status === "open").length };
  }, [trades]);

  const equityCurve = useMemo(() => {
    const closed = [...trades]
      .filter((t) => t.status === "closed" && t.closed_at)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
    let running = 0;
    return closed.map((t) => {
      running += t.pnl_usd ?? 0;
      return { date: new Date(t.closed_at!).toLocaleDateString(), equity: Math.round(running * 100) / 100 };
    });
  }, [trades]);

  return (
    <AuthGate>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Trade Journal</h1>
        <button className="btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New trade"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total P&L" value={`$${stats.totalPnl.toFixed(2)}`} />
        <StatCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} />
        <StatCard label="Open trades" value={String(stats.openCount)} />
        <StatCard label="Closed trades" value={String(stats.closedCount)} />
      </div>

      {equityCurve.length > 1 && (
        <div className="card mb-6 h-64">
          <div className="label mb-2">Equity curve (cumulative P&L)</div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip contentStyle={{ background: "#121823", border: "1px solid #1f2937" }} />
              <Line type="monotone" dataKey="equity" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div className="card mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Symbol</label>
              <select
                className="input"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              >
                <option value="SOLUSDT">SOLUSDT</option>
                <option value="BNBUSDT">BNBUSDT</option>
                <option value="HYPEUSDT">HYPEUSDT</option>
              </select>
            </div>
            <div>
              <label className="label">Direction</label>
              <select
                className="input"
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as "long" | "short" })}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label className="label">Entry price</label>
              <input
                className="input"
                type="number"
                step="any"
                onChange={(e) => setForm({ ...form, entry_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Stop price</label>
              <input
                className="input"
                type="number"
                step="any"
                onChange={(e) => setForm({ ...form, stop_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Take profit</label>
              <input
                className="input"
                type="number"
                step="any"
                onChange={(e) => setForm({ ...form, take_profit_price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Position size ($)</label>
              <input
                className="input"
                type="number"
                step="any"
                onChange={(e) => setForm({ ...form, position_size_usd: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes (criteria seen, reasoning)</label>
            <textarea
              className="input"
              rows={3}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button className="btn" onClick={addTrade}>
            Save trade
          </button>
        </div>
      )}

      {loading && <p className="text-gray-400">Loading…</p>}

      <div className="space-y-3">
        {trades.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{t.symbol}</span>{" "}
                <span className={t.direction === "long" ? "text-good" : "text-bad"}>{t.direction.toUpperCase()}</span>{" "}
                <span className="text-sm text-gray-400">· {t.status}</span>
                {t.criteria_met != null && <span className="text-sm text-gray-400"> · {t.criteria_met}/4 criteria</span>}
              </div>
              {t.pnl_usd != null && (
                <span className={t.pnl_usd >= 0 ? "text-good font-semibold" : "text-bad font-semibold"}>
                  ${t.pnl_usd.toFixed(2)} ({t.pnl_pct?.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm text-gray-300 mt-2">
              <div>
                <div className="label">Entry</div>
                {t.entry_price}
              </div>
              <div>
                <div className="label">Stop</div>
                {t.stop_price}
              </div>
              <div>
                <div className="label">TP</div>
                {t.take_profit_price}
              </div>
              <div>
                <div className="label">Size</div>
                ${t.position_size_usd}
              </div>
              <div>
                <div className="label">Exit</div>
                {t.exit_price ?? "—"}
              </div>
            </div>
            {t.notes && <p className="text-sm text-gray-400 mt-2">{t.notes}</p>}
            {t.status === "open" && (
              <button
                className="btn mt-3"
                onClick={() => {
                  const exit = prompt("Exit price?");
                  if (exit) closeTrade(t, Number(exit));
                }}
              >
                Close trade
              </button>
            )}
          </div>
        ))}
      </div>
    </AuthGate>
  );
}
