"use client";

import { useEffect, useState } from "react";
import type { Shift } from "@/lib/types";
import { X, Trash2, Save, AlertTriangle } from "lucide-react";
import { SHIFT_LABELS } from "@/lib/format";

interface Props {
  shift: Shift;
  onClose: () => void;
  // onSaved prima azuriranu smenu (za optimistic update u parent-u);
  // za delete prosledjuje { deleted: true, id }.
  onSaved: (
    payload:
      | { deleted: false; shift: Shift }
      | { deleted: true; id: string }
  ) => void;
}

export default function ShiftEditModal({ shift, onClose, onSaved }: Props) {
  const [shiftType, setShiftType] = useState(shift.shift_type);
  const [shiftDate, setShiftDate] = useState(shift.shift_date);
  const [entries, setEntries] = useState(String(shift.entries));
  const [buyers, setBuyers] = useState(String(shift.buyers));
  const [revenue, setRevenue] = useState(String(shift.revenue));
  const [itemsSold, setItemsSold] = useState(String(shift.items_sold));
  const [note, setNote] = useState(shift.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_date: shiftDate,
          shift_type: shiftType,
          entries: Number(entries),
          buyers: Number(buyers),
          revenue: Number(revenue),
          items_sold: Number(itemsSold),
          note: note || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška pri snimanju.");
      }
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        shift?: Shift;
      };
      const updated: Shift = j.shift ?? {
        ...shift,
        shift_date: shiftDate,
        shift_type: shiftType,
        entries: Number(entries),
        buyers: Number(buyers),
        revenue: Number(revenue),
        items_sold: Number(itemsSold),
        note: note || null,
      };
      onSaved({ deleted: false, shift: updated });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setErr(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Greška pri brisanju.");
      }
      onSaved({ deleted: true, id: shift.id });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-ink-900">Izmena smene</h3>
            <p className="text-xs text-ink-500">
              {shift.store_id} · {shift.shift_date}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ink-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Datum</label>
              <input
                type="date"
                className="input"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Smena</label>
              <select
                className="input"
                value={shiftType}
                onChange={(e) =>
                  setShiftType(e.target.value as typeof shiftType)
                }
              >
                {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ulasci</label>
              <input
                type="number"
                min={0}
                className="input"
                value={entries}
                onChange={(e) => setEntries(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Broj računa</label>
              <input
                type="number"
                min={0}
                className="input"
                value={buyers}
                onChange={(e) => setBuyers(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Promet (RSD)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Broj artikala</label>
              <input
                type="number"
                min={0}
                className="input"
                value={itemsSold}
                onChange={(e) => setItemsSold(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Napomena</label>
            <textarea
              rows={2}
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {err && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 p-3 text-sm flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-between gap-2 bg-ink-50/40 sticky bottom-0">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-rose-700 hover:bg-rose-50"
              disabled={saving || deleting}
            >
              <Trash2 size={16} /> Obriši smenu
            </button>
          ) : (
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-rose-700 font-semibold">
                Trajno obrisati?
              </span>
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="h-9 px-3 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700"
              >
                {deleting ? "Brišem..." : "Da, obriši"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-3 rounded-lg text-sm font-semibold bg-ink-100 text-ink-800 hover:bg-ink-200"
              >
                Otkaži
              </button>
            </div>
          )}
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={saving || deleting}
            >
              Zatvori
            </button>
            <button
              type="button"
              onClick={save}
              className="btn-primary"
              disabled={saving || deleting}
            >
              <Save size={16} /> {saving ? "Čuvam..." : "Sačuvaj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
