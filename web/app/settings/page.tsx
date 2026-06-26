"use client";
import { useEffect, useState } from "react";
import AuthGate, { useUserId } from "@/components/AuthGate";
import { supabase } from "@/lib/supabaseClient";
import type { AccountSettings, Watchlist } from "@/lib/types";

export default function SettingsPage() {
  const userId = useUserId();
  const [settings, setSettings] = useState<Partial<AccountSettings>>({});
  const [watchlist, setWatchlist] = useState<Watchlist[]>([]);
  const [saved, setSaved] = useState(false);

  async function load() {
    const { data: s } = await supabase.from("account_settings").select("*").limit(1).maybeSingle();
    if (s) setSettings(s);
    const { data: w } = await supabase.from("watchlist").select("*").order("symbol");
    setWatchlist((w as Watchlist[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings() {
    if (!userId) return;
    if (settings.id) {
      await supabase.from("account_settings").update(settings).eq("id", settings.id);
    } else {
      await supabase.from("account_settings").insert({ ...settings, user_id: userId });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function updateWatchlistRow(row: Watchlist) {
    await supabase.from("watchlist").update(row).eq("id", row.id);
    load();
  }

  async function addSymbol(symbol: string) {
    if (!userId) return;
    await supabase.from("watchlist").insert({ user_id: userId, symbol });
    load();
  }

  return (
    <AuthGate>
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      <div className="card mb-6 space-y-3">
        <h2 className="font-semibold">Account & risk</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Max allocation ($)</label>
            <input
              className="input"
              type="number"
              value={settings.allocation_usd ?? 150}
              onChange={(e) => setSettings({ ...settings, allocation_usd: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Min criteria to alert (1-4)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={4}
              value={settings.min_criteria_to_alert ?? 3}
              onChange={(e) => setSettings({ ...settings, min_criteria_to_alert: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Risk min (%)</label>
            <input
              className="input"
              type="number"
              value={settings.risk_min_pct ?? 5}
              onChange={(e) => setSettings({ ...settings, risk_min_pct: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Risk max (%)</label>
            <input
              className="input"
              type="number"
              value={settings.risk_max_pct ?? 10}
              onChange={(e) => setSettings({ ...settings, risk_max_pct: Number(e.target.value) })}
            />
          </div>
        </div>
        <button className="btn" onClick={saveSettings}>
          Save
        </button>
        {saved && <span className="text-good text-sm ml-3">Saved</span>}
      </div>

      <div className="card mb-6 space-y-4">
        <h2 className="font-semibold">Watchlist & criteria thresholds</h2>
        <p className="text-sm text-gray-400">
          Tune how the scanner detects each of your 4 criteria, per symbol. The scanner picks these up
          automatically on its next scheduled scan.
        </p>
        {watchlist.map((w) => (
          <div key={w.id} className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{w.symbol}</span>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                Active
                <input
                  type="checkbox"
                  checked={w.is_active}
                  onChange={(e) => updateWatchlistRow({ ...w, is_active: e.target.checked })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="label">Entry timeframe</label>
                <input
                  className="input"
                  value={w.entry_timeframe}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, entry_timeframe: e.target.value } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, entry_timeframe: e.target.value })}
                />
              </div>
              <div>
                <label className="label">HTF timeframe</label>
                <input
                  className="input"
                  value={w.htf_timeframe}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, htf_timeframe: e.target.value } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, htf_timeframe: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Volume drop % (C2)</label>
                <input
                  className="input"
                  type="number"
                  value={w.volume_drop_pct}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, volume_drop_pct: Number(e.target.value) } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, volume_drop_pct: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Rejection wick ratio (C3)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={w.rejection_wick_ratio}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, rejection_wick_ratio: Number(e.target.value) } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, rejection_wick_ratio: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">RSI overbought (C4)</label>
                <input
                  className="input"
                  type="number"
                  value={w.rsi_overbought}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, rsi_overbought: Number(e.target.value) } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, rsi_overbought: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">RSI oversold (C4)</label>
                <input
                  className="input"
                  type="number"
                  value={w.rsi_oversold}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, rsi_oversold: Number(e.target.value) } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, rsi_oversold: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Key level lookback (bars)</label>
                <input
                  className="input"
                  type="number"
                  value={w.key_level_lookback}
                  onChange={(e) => setWatchlist(watchlist.map((x) => (x.id === w.id ? { ...x, key_level_lookback: Number(e.target.value) } : x)))}
                  onBlur={(e) => updateWatchlistRow({ ...w, key_level_lookback: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          {["SOLUSDT", "BNBUSDT", "HYPEUSDT"]
            .filter((s) => !watchlist.some((w) => w.symbol === s))
            .map((s) => (
              <button key={s} className="btn" onClick={() => addSymbol(s)}>
                + Add {s}
              </button>
            ))}
        </div>
      </div>
    </AuthGate>
  );
}
