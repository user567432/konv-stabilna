"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Users,
  Trash2,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface Worker {
  id: string;
  initials: string;
  store_id: string;
  active: boolean;
  created_at: string;
}

const STORES = [
  { value: "D1", label: "D1 · Ženska Dušanova" },
  { value: "D2", label: "D2 · Muška Dušanova" },
  { value: "D4", label: "D4 · Ženska Delta Planet" },
  { value: "D5", label: "D5 · Muška Delta Planet" },
];

const STORE_SHORT: Record<string, string> = {
  D1: "D1 · Ž Dušanova",
  D2: "D2 · M Dušanova",
  D4: "D4 · Ž Delta",
  D5: "D5 · M Delta",
};

export default function WorkersManager() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form
  const [newInitials, setNewInitials] = useState("");
  const [newStore, setNewStore] = useState("D1");
  const [adding, setAdding] = useState(false);

  // Store change in-row
  const [pendingChange, setPendingChange] = useState<{
    id: string;
    store: string;
  } | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Worker | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/workers", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      setWorkers(j.workers ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  }

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const initials = newInitials.trim().toUpperCase();
    if (!initials || initials.length > 8) {
      setErr("Inicijali: 1-8 znakova.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials, store_id: newStore }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      setNewInitials("");
      flashSuccess(`Dodata radnica ${initials} u ${newStore}.`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setAdding(false);
    }
  }

  async function changeStore(w: Worker, newStoreId: string) {
    if (newStoreId === w.store_id) {
      setPendingChange(null);
      return;
    }
    setErr(null);
    try {
      const res = await fetch("/api/workers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id, new_store_id: newStoreId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      flashSuccess(`${w.initials}: ${w.store_id} → ${newStoreId}`);
      setPendingChange(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function deleteWorker(w: Worker) {
    setErr(null);
    try {
      const res = await fetch(`/api/workers?id=${w.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      flashSuccess(`${w.initials} deaktivirana.`);
      setConfirmDelete(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function reactivateWorker(w: Worker) {
    setErr(null);
    try {
      const res = await fetch(`/api/workers?id=${w.id}&reactivate=1`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Greška.");
      flashSuccess(`${w.initials} vraćena u aktivne.`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  // Grouping po radnji
  const byStore = new Map<string, Worker[]>();
  STORES.forEach((s) => byStore.set(s.value, []));
  workers.forEach((w) => {
    if (!showInactive && !w.active) return;
    const arr = byStore.get(w.store_id) ?? [];
    arr.push(w);
    byStore.set(w.store_id, arr);
  });
  const inactiveCount = workers.filter((w) => !w.active).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0">
          <Users size={22} />
        </div>
        <div>
          <h2 className="font-bold text-ink-900">Radnici</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            Dodaj, obriši, ili premesti radnicu u drugu radnju. Inicijali se koriste za unos
            smena i rang-listu.
          </p>
        </div>
      </div>

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {err}
        </div>
      )}

      {/* Dodaj novog */}
      <form
        onSubmit={addWorker}
        className="rounded-xl bg-ink-50 p-4 grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
      >
        <div>
          <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
            Inicijali
          </label>
          <input
            value={newInitials}
            onChange={(e) => setNewInitials(e.target.value)}
            placeholder="npr. IJ"
            maxLength={8}
            className="input mt-1.5 uppercase font-mono"
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
            Radnja
          </label>
          <select
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            className="input mt-1.5"
          >
            {STORES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={adding}>
          <UserPlus size={16} /> {adding ? "Dodajem..." : "Dodaj"}
        </button>
      </form>

      {/* Toggle neaktivni */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-500">
          Ukupno {workers.filter((w) => w.active).length} aktivnih
          {inactiveCount > 0 && <> · {inactiveCount} neaktivnih</>}
        </div>
        {inactiveCount > 0 && (
          <label className="text-xs text-ink-600 flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Prikaži neaktivne
          </label>
        )}
      </div>

      {/* Lista po radnjama */}
      {loading ? (
        <div className="text-sm text-ink-400 py-4">Učitavam...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {STORES.map((s) => {
            const list = byStore.get(s.value) ?? [];
            return (
              <div key={s.value} className="rounded-xl bg-white border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-sm text-ink-900">
                    <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded mr-2">
                      {s.value}
                    </span>
                    {s.label.replace(`${s.value} · `, "")}
                  </div>
                  <span className="text-xs text-ink-400">
                    {list.filter((w) => w.active).length} akt.
                  </span>
                </div>
                {list.length === 0 ? (
                  <div className="text-xs text-ink-400 italic py-2">
                    Nema radnica u ovoj radnji.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((w) => (
                      <li
                        key={w.id}
                        className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1.5 ${
                          w.active ? "bg-ink-50" : "bg-ink-100 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold">
                            {w.initials}
                          </span>
                          {!w.active && (
                            <span className="text-xs text-ink-400">
                              (neaktivna)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {w.active ? (
                            <>
                              <button
                                onClick={() =>
                                  setPendingChange(
                                    pendingChange?.id === w.id
                                      ? null
                                      : { id: w.id, store: w.store_id }
                                  )
                                }
                                className="text-xs p-1.5 rounded hover:bg-ink-200 text-ink-600"
                                title="Premesti u drugu radnju"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(w)}
                                className="text-xs p-1.5 rounded hover:bg-rose-100 text-rose-600"
                                title="Obriši (deaktiviraj)"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => reactivateWorker(w)}
                              className="text-xs p-1.5 rounded hover:bg-emerald-100 text-emerald-700"
                              title="Vrati u aktivne"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                        {pendingChange?.id === w.id && (
                          <div className="absolute mt-8 ml-0 z-10 bg-white border border-ink-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                            <div className="text-xs font-bold text-ink-700 mb-2">
                              Premesti {w.initials} u:
                            </div>
                            {STORES.filter((x) => x.value !== w.store_id).map(
                              (opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => changeStore(w, opt.value)}
                                  className="block w-full text-left text-sm px-2 py-1.5 hover:bg-ink-50 rounded"
                                >
                                  <span className="font-mono font-bold mr-1.5">
                                    {opt.value}
                                  </span>
                                  <span className="text-ink-600">
                                    {STORE_SHORT[opt.value].replace(
                                      `${opt.value} · `,
                                      ""
                                    )}
                                  </span>
                                </button>
                              )
                            )}
                            <button
                              onClick={() => setPendingChange(null)}
                              className="text-xs text-ink-400 mt-2 block"
                            >
                              Otkaži
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
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
                <h3 className="font-bold text-lg">Deaktiviraj radnicu</h3>
                <p className="text-xs text-ink-500">
                  {confirmDelete.initials} iz {confirmDelete.store_id}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-600">
              Radnica <b>{confirmDelete.initials}</b> neće više biti dostupna za nove smene, ali
              njene postojeće smene ostaju u istoriji i rang-listi. Možeš je kasnije vratiti
              nazad.
            </p>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-ghost"
              >
                Otkaži
              </button>
              <button
                onClick={() => deleteWorker(confirmDelete)}
                className="btn-primary !bg-rose-600 hover:!bg-rose-700"
              >
                Deaktiviraj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
