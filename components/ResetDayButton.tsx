"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

const STORE_OPTIONS = [
  { value: "", label: "Sve 4 radnje" },
  { value: "D1", label: "D1 · Ženska Dušanova" },
  { value: "D2", label: "D2 · Muška Dušanova" },
  { value: "D4", label: "D4 · Ženska Delta Planet" },
  { value: "D5", label: "D5 · Muška Delta Planet" },
];

export default function ResetDayButton({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedLabel =
    STORE_OPTIONS.find((o) => o.value === storeId)?.label ?? "Sve 4 radnje";

  const requiredText = storeId === "" ? "OBRISI SVE" : `OBRISI ${storeId}`;
  const canConfirm = confirm.trim().toUpperCase() === requiredText;

  async function doReset() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/shifts/reset-day", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          store_id: storeId || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Greška.");
      setOpen(false);
      setConfirm("");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setStoreId("");
          setConfirm("");
          setErr(null);
        }}
        className="btn-ghost !h-9 !px-3 text-sm text-rose-700 hover:!bg-rose-50"
        title="Obriši sve smene za zadati dan"
      >
        <Trash2 size={16} /> Resetuj dan
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Resetuj današnji dan</h3>
                <p className="text-xs text-ink-500">
                  {new Date(today).toLocaleDateString("sr-RS", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Radnja
                </label>
                <select
                  value={storeId}
                  onChange={(e) => {
                    setStoreId(e.target.value);
                    setConfirm("");
                  }}
                  className="input mt-1.5"
                  disabled={loading}
                >
                  {STORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
                Obrisaće sve smene za <b>{selectedLabel}</b> na dan{" "}
                <b>
                  {new Date(today).toLocaleDateString("sr-RS", {
                    day: "numeric",
                    month: "long",
                  })}
                </b>
                . Ovo se ne može poništiti.
              </div>

              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Za potvrdu kucaj:{" "}
                  <span className="font-mono text-rose-700">{requiredText}</span>
                </label>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input mt-1.5 font-mono"
                  placeholder={requiredText}
                  disabled={loading}
                  autoFocus
                />
              </div>

              {err && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  {err}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost"
                disabled={loading}
              >
                Otkaži
              </button>
              <button
                onClick={doReset}
                disabled={!canConfirm || loading}
                className="btn-primary !bg-rose-600 hover:!bg-rose-700 disabled:!bg-ink-200"
              >
                {loading ? "Brišem..." : "Resetuj dan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
