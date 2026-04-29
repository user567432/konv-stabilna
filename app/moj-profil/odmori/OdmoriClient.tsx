"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  X,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { formatDateSr } from "@/lib/format";
import LogoutButton from "../LogoutButton";
import type { MyLeaveRequest, LeaveBalance } from "./page";

interface Props {
  workerId: string;
  initialRequests: MyLeaveRequest[];
  balance: LeaveBalance;
  year: number;
}

type Step = 1 | 2 | 3; // 3 = success

export default function OdmoriClient({
  workerId,
  initialRequests,
  balance,
  year,
}: Props) {
  const [requests, setRequests] = useState<MyLeaveRequest[]>(initialRequests);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openWizard() {
    setStep(1);
    setStartDate("");
    setEndDate("");
    setReason("");
    setErr(null);
    setWizardOpen(true);
  }

  function closeWizard() {
    if (busy) return;
    setWizardOpen(false);
  }

  function nextFromStep1(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!startDate || !endDate) {
      setErr("Unesi oba datuma.");
      return;
    }
    if (endDate < startDate) {
      setErr("Datum povratka mora biti posle datuma odlaska.");
      return;
    }
    setStep(2);
  }

  async function submitRequest() {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("create_leave_request", {
          p_worker_id: workerId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_reason: reason.trim() || null,
        })
        .single<MyLeaveRequest>();
      if (error) throw new Error(error.message);
      if (data) {
        setRequests((rs) => [data, ...rs]);
      }
      setStep(3);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  function calcDays(): number {
    if (!startDate || !endDate) return 0;
    const a = new Date(startDate + "T00:00:00");
    const b = new Date(endDate + "T00:00:00");
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/moj-profil"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Profil
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">
              Godišnji odmor
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-ink-700" />
            Godišnji odmor
          </h1>
          <p className="mt-1 text-ink-500">
            Tvoji zahtevi i preostali dani za {year}.
          </p>
        </section>

        {/* Saldo dana */}
        <section className="card-soft">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SaldoTile
              label="Ukupno dana"
              value={balance.total_days}
              tone="neutral"
            />
            <SaldoTile
              label="Iskorišćeno"
              value={balance.used_days}
              tone="neutral"
            />
            <SaldoTile
              label="Na čekanju"
              value={balance.pending_days}
              tone="warn"
            />
            <SaldoTile
              label="Preostalo"
              value={balance.remaining_days}
              tone="good"
            />
          </div>
        </section>

        {/* Action: novi zahtev */}
        <section>
          <button
            type="button"
            onClick={openWizard}
            className="w-full h-14 rounded-2xl bg-ink-900 hover:bg-ink-800 text-white font-bold text-base inline-flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Novi zahtev za odmor
          </button>
        </section>

        {/* Lista zahteva */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Moji zahtevi
          </h2>

          {requests.length === 0 ? (
            <div className="card-soft text-center py-10 text-ink-400">
              <Calendar className="mx-auto mb-2" size={20} />
              Još nema zahteva. Kad pošalješ prvi, pojaviće se ovde.
            </div>
          ) : (
            requests.map((r) => <RequestCard key={r.id} req={r} />)
          )}
        </section>
      </div>

      {wizardOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWizard();
          }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
            {step !== 3 && (
              <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                    Novi zahtev za odmor
                  </div>
                  <div className="text-sm font-bold text-ink-900 mt-0.5">
                    Korak {step} od 2
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeWizard}
                  disabled={busy}
                  className="p-1.5 rounded hover:bg-ink-100"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {step !== 3 && (
              <div className="h-1.5 bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-ink-900 transition-all duration-300"
                  style={{ width: `${(step / 2) * 100}%` }}
                />
              </div>
            )}

            <div className="p-5">
              {step === 1 && (
                <form onSubmit={nextFromStep1} className="space-y-4">
                  <h3 className="text-lg font-bold text-ink-900">
                    Kada želiš odmor?
                  </h3>
                  <p className="text-sm text-ink-500 leading-relaxed">
                    Izaberi datum kad polaziš i datum kad se vraćaš na posao.
                    Sistem će sam izračunati broj dana.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">
                        Od
                      </label>
                      <input
                        type="date"
                        className="input mt-2"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">
                        Do (uključujući)
                      </label>
                      <input
                        type="date"
                        className="input mt-2"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {startDate && endDate && endDate >= startDate && (
                    <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-sm text-sky-900">
                      Ukupno: <b>{calcDays()} dana</b>
                    </div>
                  )}

                  {err && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2.5 text-sm flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full h-14 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold text-base"
                  >
                    Dalje →
                  </button>
                </form>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-ink-900">
                    Razlog (opciono)
                  </h3>
                  <p className="text-sm text-ink-500 leading-relaxed">
                    Možeš da napišeš kratak razlog (npr. „Putovanje sa porodicom"),
                    ili ostavi prazno ako ne želiš.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">
                      Razlog
                    </label>
                    <textarea
                      rows={3}
                      className="input mt-2"
                      placeholder="Npr. Putovanje za Crnu Goru"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={200}
                    />
                  </div>

                  <div className="rounded-xl bg-ink-50 border border-ink-100 px-3 py-2.5 text-sm text-ink-700">
                    <div className="font-semibold mb-1">Pregled zahteva:</div>
                    <div className="tabular-nums">
                      {formatDateSr(startDate)} — {formatDateSr(endDate)}
                    </div>
                    <div>
                      Ukupno: <b>{calcDays()} dana</b>
                    </div>
                  </div>

                  {err && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2.5 text-sm flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={busy}
                      className="h-14 px-4 rounded-xl border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 font-semibold text-sm"
                    >
                      Nazad
                    </button>
                    <button
                      type="button"
                      onClick={submitRequest}
                      disabled={busy}
                      className="flex-1 h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base disabled:opacity-60"
                    >
                      {busy ? "Šaljem…" : "Pošalji zahtev"}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-ink-900 mb-2">
                    Zahtev je poslat!
                  </h3>
                  <p className="text-sm text-ink-500 leading-relaxed mb-5">
                    Šef će videti tvoj zahtev i odgovoriti uskoro. Status možeš
                    da pratiš ovde u listi ispod.
                  </p>
                  <button
                    type="button"
                    onClick={closeWizard}
                    className="h-12 px-5 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-semibold"
                  >
                    Zatvori
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SaldoTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-0.5">
        {label}
      </div>
      <div
        className={clsx(
          "text-2xl font-bold tabular-nums",
          tone === "good" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "neutral" && "text-ink-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RequestCard({ req }: { req: MyLeaveRequest }) {
  return (
    <div className="card-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusPill status={req.status} />
          </div>
          <div className="text-base font-bold text-ink-900 tabular-nums">
            {formatDateSr(req.start_date)} — {formatDateSr(req.end_date)}
          </div>
          <div className="text-sm text-ink-500 mt-0.5">
            {req.days_count} dan{req.days_count !== 1 ? "a" : ""}
          </div>
          {req.reason && (
            <div className="text-sm text-ink-500 mt-1.5 italic">
              „{req.reason}"
            </div>
          )}
          {req.review_note && (
            <div
              className={clsx(
                "text-xs mt-2 px-2 py-1 rounded",
                req.status === "approved"
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-rose-50 text-rose-900"
              )}
            >
              <b>Šef:</b> {req.review_note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
        <Clock3 size={10} /> Na čekanju
      </span>
    );
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
        <CheckCircle2 size={10} /> Odobren
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 px-2 py-0.5 rounded">
      <XCircle size={10} /> Odbijen
    </span>
  );
}
