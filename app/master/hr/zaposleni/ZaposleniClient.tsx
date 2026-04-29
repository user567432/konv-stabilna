"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Pencil,
  X,
  Save,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { STORE_LABELS_SHORT, formatDateSr, formatRSD } from "@/lib/format";
import LogoutButton from "../../LogoutButton";
import type { WorkerProfile } from "./page";

const STORES = ["D1", "D2", "D4", "D5"];

const STATUS_OPTIONS: Array<{ value: "junior" | "medior" | "senior"; label: string; description: string }> = [
  { value: "junior", label: "Junior", description: "Početnik, do 1 godine iskustva" },
  { value: "medior", label: "Medior", description: "Iskusna, 1–3 godine" },
  { value: "senior", label: "Senior", description: "Vodeća, 3+ godine, mentorka" },
];

interface EditState {
  worker: WorkerProfile;
  full_name: string;
  status: "junior" | "medior" | "senior" | "";
  employment_until: string;
}

export default function ZaposleniClient({
  initialWorkers,
}: {
  initialWorkers: WorkerProfile[];
}) {
  const [workers, setWorkers] = useState<WorkerProfile[]>(initialWorkers);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, WorkerProfile[]>();
    STORES.forEach((s) => m.set(s, []));
    workers.forEach((w) => {
      const arr = m.get(w.store_id) ?? [];
      arr.push(w);
      m.set(w.store_id, arr);
    });
    return STORES.map((s) => ({ storeId: s, list: m.get(s) ?? [] }));
  }, [workers]);

  function openEdit(w: WorkerProfile) {
    setEditing({
      worker: w,
      full_name: w.full_name ?? "",
      status: w.status ?? "",
      employment_until: w.employment_until ?? "",
    });
    setErr(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("update_worker_profile", {
          p_worker_id: editing.worker.id,
          p_full_name: editing.full_name.trim() || null,
          p_status: editing.status || null,
          p_employment_until: editing.employment_until || null,
        })
        .single<Record<string, unknown>>();
      if (error) throw new Error(error.message);

      // Optimistic update
      setWorkers((ws) =>
        ws.map((w) =>
          w.id === editing.worker.id
            ? {
                ...w,
                full_name: editing.full_name.trim() || null,
                status: (editing.status || null) as WorkerProfile["status"],
                employment_until: editing.employment_until || null,
              }
            : w
        )
      );
      setEditing(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/hr"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> HR
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">
              Status zaposlenih
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-ink-700" />
            Status zaposlenih
          </h1>
          <p className="mt-1 text-ink-500">
            Pregled radnica grupisanih po radnji. Klik na karticu otvara
            detalje za izmenu (ime, status, do kada je prijavljena).
          </p>
        </section>

        {grouped.map(({ storeId, list }) => (
          <section key={storeId}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3 inline-flex items-center gap-2">
              <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded">
                {storeId}
              </span>
              {(STORE_LABELS_SHORT[storeId] ?? storeId).replace(
                `${storeId} `,
                ""
              )}
              <span className="text-[11px] text-ink-400 normal-case font-normal">
                · {list.length} radnica
              </span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.length === 0 ? (
                <div className="col-span-full text-sm text-ink-400 italic py-3">
                  Nema aktivnih radnica.
                </div>
              ) : (
                list.map((w) => (
                  <WorkerCard key={w.id} worker={w} onEdit={() => openEdit(w)} />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-ink-900">
                  Izmena —{" "}
                  <span className="font-mono">{editing.worker.initials}</span>{" "}
                  <span className="text-xs font-normal text-ink-500">
                    ({editing.worker.store_id})
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Ime i prezime
                </label>
                <input
                  type="text"
                  className="input mt-2"
                  value={editing.full_name}
                  onChange={(e) =>
                    setEditing({ ...editing, full_name: e.target.value })
                  }
                  placeholder="Npr. Ivana Jovanović"
                  maxLength={80}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2 block">
                  Status prodavca
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = editing.status === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() =>
                          setEditing({ ...editing, status: opt.value })
                        }
                        className={clsx(
                          "px-3 py-2.5 rounded-xl border-2 text-left transition",
                          active
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white hover:border-ink-400"
                        )}
                      >
                        <div className="font-bold text-sm">{opt.label}</div>
                        <div
                          className={clsx(
                            "text-[11px] mt-0.5",
                            active ? "text-white/70" : "text-ink-500"
                          )}
                        >
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, status: "" })}
                    className={clsx(
                      "px-3 py-2 rounded-xl border text-left text-xs transition",
                      editing.status === ""
                        ? "border-ink-700 bg-ink-50"
                        : "border-ink-200 bg-white hover:bg-ink-50 text-ink-500"
                    )}
                  >
                    — Bez statusa —
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Do kada je prijavljena (datum isteka)
                </label>
                <input
                  type="date"
                  className="input mt-2"
                  value={editing.employment_until}
                  onChange={(e) =>
                    setEditing({ ...editing, employment_until: e.target.value })
                  }
                />
                <p className="text-[11px] text-ink-500 mt-1">
                  Ostavi prazno ako je na neodređeno. Sistem će te upozoriti
                  kad se približi datum.
                </p>
              </div>

              {err && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-900 flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-end gap-2 bg-ink-50/40 sticky bottom-0">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="btn-ghost"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                className="btn-primary"
              >
                {busy ? (
                  "Snimam…"
                ) : (
                  <>
                    <Save size={16} /> Sačuvaj
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function WorkerCard({
  worker,
  onEdit,
}: {
  worker: WorkerProfile;
  onEdit: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const expiringSoon =
    worker.employment_until &&
    worker.employment_until > today &&
    diffDays(worker.employment_until, today) <= 30;
  const expired =
    worker.employment_until && worker.employment_until <= today;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="card-soft text-left hover:border-ink-900 hover:-translate-y-0.5 transition-all w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-mono font-bold text-base text-ink-900">
            {worker.initials}
          </div>
          {worker.full_name && (
            <div className="text-sm text-ink-700 font-medium mt-0.5">
              {worker.full_name}
            </div>
          )}
        </div>
        <Pencil size={14} className="text-ink-300" />
      </div>

      <div className="space-y-1.5 mt-3">
        {worker.status ? (
          <StatusBadge status={worker.status} />
        ) : (
          <span className="text-[11px] text-ink-400 italic">
            Status nije postavljen
          </span>
        )}

        {worker.employment_until && (
          <div
            className={clsx(
              "text-[11px] inline-flex items-center gap-1",
              expired
                ? "text-rose-700"
                : expiringSoon
                  ? "text-amber-700"
                  : "text-ink-500"
            )}
          >
            <Calendar size={11} />
            <span className="tabular-nums">
              {expired ? "Istekao: " : "Do: "}
              {formatDateSr(worker.employment_until)}
            </span>
          </div>
        )}

        {worker.base_salary != null && (
          <div className="text-[11px] text-ink-500 tabular-nums">
            Fiksna: {formatRSD(worker.base_salary)}
          </div>
        )}

        {worker.hire_date && (
          <div className="text-[11px] text-ink-400 tabular-nums">
            Zaposlena od {formatDateSr(worker.hire_date)}
          </div>
        )}
      </div>
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: "junior" | "medior" | "senior";
}) {
  const map = {
    junior: { bg: "bg-sky-100", text: "text-sky-900", label: "Junior" },
    medior: { bg: "bg-amber-100", text: "text-amber-900", label: "Medior" },
    senior: { bg: "bg-emerald-100", text: "text-emerald-900", label: "Senior" },
  };
  const cfg = map[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
        cfg.bg,
        cfg.text
      )}
    >
      <CheckCircle2 size={10} className="mr-1" /> {cfg.label}
    </span>
  );
}

function diffDays(later: string, earlier: string): number {
  const a = new Date(later + "T00:00:00").getTime();
  const b = new Date(earlier + "T00:00:00").getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}
