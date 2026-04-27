"use client";

import { useEffect, useState } from "react";
import type { WeeklyGoal } from "@/lib/types";
import { formatRSD, formatDateSr } from "@/lib/format";
import { Pencil, RotateCcw, Check, X, AlertCircle } from "lucide-react";

interface Props {
  storeId: string;
  storeName: string;
}

export default function WeeklyGoalsEditor({ storeId, storeName }: Props) {
  const [weeks, setWeeks] = useState<WeeklyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Fetchovanje za tekući i sledeći mesec
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-01`;
      const res = await fetch(
        `/api/weekly-goals?store_id=${storeId}&month=${currentMonth}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška pri učitavanju.");
      }
      const j = await res.json();
      setWeeks(j.weeks ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/weekly-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, goal_rsd: Number(editValue) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška.");
      }
      setEditingId(null);
      setEditValue("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  async function resetWeek(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/weekly-goals?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška.");
      }
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-ink-500 italic py-2">Učitavam nedeljne ciljeve...</div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-sm text-ink-500 italic py-2 rounded-xl bg-ink-50 px-3">
        Nema još raspoređenih nedelja. Upiši mesečni cilj iznad i sačuvaj da generišeš nedeljne ciljeve za {storeName}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
        Nedeljni ciljevi za {storeName} (tekući mesec)
      </div>

      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 p-3 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-500 font-semibold uppercase border-b border-ink-100">
              <th className="text-left py-2">Nedelja</th>
              <th className="text-right py-2">Cilj (RSD)</th>
              <th className="text-right py-2">Izvor</th>
              <th className="text-right py-2 w-32">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {weeks.map((w) => {
              const isEditing = editingId === w.id;
              return (
                <tr key={w.id}>
                  <td className="py-2.5">
                    {formatDateSr(w.week_start)} — {formatDateSr(w.week_end)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step="10000"
                        className="input py-1 px-2 text-right w-36 ml-auto"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      formatRSD(Number(w.goal_rsd))
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {w.manual_override ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Ručno
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-600">
                        Auto
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(w.id)}
                          disabled={saving}
                          className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          title="Sačuvaj"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditValue("");
                          }}
                          className="p-1.5 rounded bg-ink-200 text-ink-800 hover:bg-ink-300"
                          title="Otkaži"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(w.id);
                            setEditValue(String(Math.round(Number(w.goal_rsd))));
                          }}
                          className="p-1.5 rounded bg-ink-100 text-ink-800 hover:bg-ink-200"
                          title="Izmeni"
                        >
                          <Pencil size={14} />
                        </button>
                        {w.manual_override && (
                          <button
                            type="button"
                            onClick={() => resetWeek(w.id)}
                            disabled={saving}
                            className="p-1.5 rounded bg-ink-100 text-ink-800 hover:bg-ink-200 disabled:opacity-50"
                            title="Vrati na auto"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
