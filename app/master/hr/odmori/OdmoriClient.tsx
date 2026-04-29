"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { formatDateSr } from "@/lib/format";
import type { LeaveRequestRow } from "./page";

interface Props {
  initialRows: LeaveRequestRow[];
  activeFilter: string; // "all" | "pending" | "approved" | "rejected"
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "pending", label: "Na čekanju" },
  { key: "approved", label: "Odobreni" },
  { key: "rejected", label: "Odbijeni" },
  { key: "all", label: "Svi" },
];

export default function OdmoriClient({ initialRows, activeFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = useState<LeaveRequestRow[]>(initialRows);
  const [reviewing, setReviewing] = useState<{
    row: LeaveRequestRow;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Resync na navigaciju
  useEffect(() => {
    setRows(initialRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  function changeFilter(key: string) {
    const sp = new URLSearchParams();
    if (key !== "all") sp.set("status", key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function startReview(row: LeaveRequestRow, action: "approve" | "reject") {
    setReviewNote("");
    setErr(null);
    setReviewing({ row, action });
  }

  async function submitReview() {
    if (!reviewing) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("review_leave_request", {
          p_request_id: reviewing.row.id,
          p_action: reviewing.action,
          p_note: reviewNote.trim() || null,
        })
        .single<LeaveRequestRow>();

      if (error) throw new Error(error.message);

      // Optimistic: zameni red u listi
      setRows((rs) =>
        rs.map((r) =>
          r.id === reviewing.row.id
            ? {
                ...r,
                status:
                  reviewing.action === "approve" ? "approved" : "rejected",
                reviewed_at: new Date().toISOString(),
                review_note: reviewNote.trim() || null,
              }
            : r
        )
      );
      setReviewing(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

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
              Godišnji odmor
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              <Clock3 size={12} /> {pendingCount} na čekanju
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-ink-700" />
            Godišnji odmor
          </h1>
          <p className="mt-1 text-ink-500">
            Pregled zahteva radnica. Odobrena pojavljuju se u njihovom profilu, a
            saldo dana se umanjuje.
          </p>
        </section>

        <section className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            const count = f.key === "all"
              ? rows.length
              : rows.filter((r) => r.status === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => changeFilter(f.key)}
                className={
                  active
                    ? "px-3 py-2 rounded-xl bg-ink-900 text-white text-sm font-semibold inline-flex items-center gap-2"
                    : "px-3 py-2 rounded-xl bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100 inline-flex items-center gap-2"
                }
              >
                {f.label}
                {f.key !== "all" && f.key === activeFilter && (
                  <span
                    className={clsx(
                      "text-[11px] tabular-nums px-1.5 py-0.5 rounded",
                      active ? "bg-white/20" : "bg-ink-100"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </section>

        {err && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}

        <section className="space-y-3">
          {rows.length === 0 ? (
            <div className="card-soft text-center py-12 text-ink-400">
              <Calendar className="mx-auto mb-2" size={20} />
              Nema zahteva u ovoj kategoriji.
            </div>
          ) : (
            rows.map((r) => <RequestCard key={r.id} row={r} onReview={startReview} />)
          )}
        </section>
      </div>

      {/* Review modal */}
      {reviewing && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setReviewing(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-ink-100">
              <h3 className="font-bold text-ink-900">
                {reviewing.action === "approve"
                  ? "Odobri zahtev?"
                  : "Odbij zahtev?"}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">
                {reviewing.row.worker_initials} · {reviewing.row.worker_store_id} ·{" "}
                {formatDateSr(reviewing.row.start_date)} —{" "}
                {formatDateSr(reviewing.row.end_date)} (
                {reviewing.row.days_count} dana)
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Napomena (opciono)
                </label>
                <textarea
                  rows={2}
                  className="input mt-2"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewing.action === "approve"
                      ? "Npr. odobreno, prijatno"
                      : "Npr. zauzeti datumi — pomeri za sledeću nedelju"
                  }
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-end gap-2 bg-ink-50/40">
              <button
                type="button"
                onClick={() => setReviewing(null)}
                disabled={busy}
                className="btn-ghost"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={submitReview}
                disabled={busy}
                className={clsx(
                  "h-10 px-4 rounded-lg font-semibold text-sm inline-flex items-center gap-1.5",
                  reviewing.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white",
                  busy && "opacity-60"
                )}
              >
                {busy
                  ? "Snimam…"
                  : reviewing.action === "approve"
                    ? <><Check size={16} /> Odobri</>
                    : <><X size={16} /> Odbij</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RequestCard({
  row,
  onReview,
}: {
  row: LeaveRequestRow;
  onReview: (row: LeaveRequestRow, action: "approve" | "reject") => void;
}) {
  const isPending = row.status === "pending";
  const isApproved = row.status === "approved";

  return (
    <div className="card-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-ink-900 text-base">
              {row.worker_initials}
            </span>
            <span className="text-xs font-bold bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded">
              {row.worker_store_id}
            </span>
            <StatusPill status={row.status} />
          </div>
          <div className="text-sm text-ink-700 font-semibold tabular-nums">
            {formatDateSr(row.start_date)} — {formatDateSr(row.end_date)}
            <span className="text-ink-500 font-normal">
              {" "}
              · {row.days_count} dan{row.days_count !== 1 ? "a" : ""}
            </span>
          </div>
          {row.reason && (
            <div className="text-sm text-ink-500 mt-1 italic">
              „{row.reason}"
            </div>
          )}
          {row.review_note && (
            <div
              className={clsx(
                "text-xs mt-1.5",
                isApproved ? "text-emerald-700" : "text-rose-700"
              )}
            >
              <b>Napomena:</b> {row.review_note}
            </div>
          )}
          <div className="text-[11px] text-ink-400 mt-1.5">
            Tražen{" "}
            {new Date(row.requested_at).toLocaleString("sr-RS", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {isPending && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onReview(row, "approve")}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Check size={16} /> Odobri
            </button>
            <button
              type="button"
              onClick={() => onReview(row, "reject")}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-sm font-semibold"
            >
              <X size={16} /> Odbij
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
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
