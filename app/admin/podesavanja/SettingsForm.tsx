"use client";

import { useState } from "react";
import type { Settings } from "@/lib/types";
import { CheckCircle2, Calendar } from "lucide-react";

interface Props {
  store_id: string | null;
  store_name: string;
  settings: Settings | undefined;
}

export default function SettingsForm({ store_id, settings }: Props) {
  const [conv, setConv] = useState<string>(
    String(settings?.conversion_target ?? 15)
  );
  const [aov, setAov] = useState<string>(String(settings?.aov_target ?? 3000));
  const [revenue, setRevenue] = useState<string>(
    settings?.revenue_target != null ? String(settings.revenue_target) : ""
  );
  const [monthly, setMonthly] = useState<string>(
    settings?.monthly_revenue_target != null
      ? String(settings.monthly_revenue_target)
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setRegenMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id,
          conversion_target: Number(conv),
          aov_target: Number(aov),
          revenue_target: revenue === "" ? null : Number(revenue),
          monthly_revenue_target: monthly === "" ? null : Number(monthly),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška pri čuvanju.");
      }

      // Ako imamo store_id i mesečni cilj, automatski regeneriši nedeljne ciljeve
      if (store_id && monthly !== "" && Number(monthly) > 0) {
        const today = new Date();
        const month = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-01`;
        const rgRes = await fetch("/api/weekly-goals/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_id, month, monthly_goal: Number(monthly) }),
        });
        if (rgRes.ok) {
          const j = await rgRes.json();
          setRegenMsg(
            `Nedeljni ciljevi raspoređeni (${j.weeks_created ?? 0} nedelja, ${
              j.preserved ?? 0
            } ručnih sačuvano).`
          );
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Cilj konverzije (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="input"
            value={conv}
            onChange={(e) => setConv(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Cilj prosečne vrednosti računa (RSD)</label>
          <input
            type="number"
            min={0}
            step="100"
            className="input"
            value={aov}
            onChange={(e) => setAov(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Dnevni cilj prometa (RSD · opciono)</label>
          <input
            type="number"
            min={0}
            step="1000"
            className="input"
            placeholder="npr. 150000"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
        </div>
      </div>

      {store_id && (
        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-ink-700" />
            <label className="label mb-0">Mesečni cilj prometa (RSD)</label>
          </div>
          <input
            type="number"
            min={0}
            step="10000"
            className="input"
            placeholder="npr. 3000000"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
          <p className="text-xs text-ink-500 mt-2">
            Kada upišeš mesečni cilj, sistem ga automatski raspoređuje po nedeljama{" "}
            {store_id === "D1" || store_id === "D2"
              ? "uzimajući u obzir da Dušanova radnja nedeljom ne radi, a subotom radi samo prvu smenu."
              : "ravnomerno jer Delta radi svih sedam dana."}
            {" "}Ručne izmene nedeljnih ciljeva se čuvaju i ne prepisuju se pri ponovnoj raspodeli.
          </p>
        </div>
      )}

      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 p-3 text-sm">
          {err}
        </div>
      )}

      {regenMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 text-sm">
          {regenMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Čuvam..." : "Sačuvaj"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
            <CheckCircle2 size={16} /> Sačuvano
          </span>
        )}
      </div>
    </form>
  );
}
