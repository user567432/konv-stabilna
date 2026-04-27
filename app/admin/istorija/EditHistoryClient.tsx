"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Trash2, Pencil } from "lucide-react";
import { formatRSD, formatDateSr } from "@/lib/format";
import type { ShiftEditLog } from "@/lib/types";

interface ShiftPayload {
  store_id?: string;
  shift_date?: string;
  shift_type?: string;
  entries?: number;
  buyers?: number;
  revenue?: number | string;
  items_sold?: number;
  note?: string | null;
}

function summarize(p: ShiftPayload | null | undefined): string {
  if (!p) return "—";
  const parts: string[] = [];
  if (p.shift_date) parts.push(formatDateSr(p.shift_date));
  if (p.store_id) parts.push(p.store_id);
  if (p.entries != null) parts.push(`ul. ${p.entries}`);
  if (p.buyers != null) parts.push(`rač. ${p.buyers}`);
  if (p.revenue != null) parts.push(formatRSD(Number(p.revenue)));
  return parts.join(" · ");
}

function diffBlock(
  before: ShiftPayload | null | undefined,
  after: ShiftPayload | null | undefined
) {
  if (!before || !after) return null;
  const keys: (keyof ShiftPayload)[] = [
    "shift_date",
    "shift_type",
    "entries",
    "buyers",
    "revenue",
    "items_sold",
    "note",
  ];
  const changes: { key: string; before: string; after: string }[] = [];
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (String(b ?? "") !== String(a ?? "")) {
      changes.push({
        key: String(k),
        before: String(b ?? "—"),
        after: String(a ?? "—"),
      });
    }
  }
  return changes;
}

export default function EditHistoryClient() {
  const [entries, setEntries] = useState<ShiftEditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shift-edit-log?limit=200");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Greška pri učitavanju.");
        }
        const j = await res.json();
        setEntries(j.entries ?? []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Greška.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-ink-50/30">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-5 md:px-8 h-16 flex items-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700 font-semibold"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
            <History size={14} /> Istorija izmena
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">
            Šta je menjano i obrisano
          </h1>
          <p className="mt-2 text-ink-500 text-sm">
            Svaka izmena i brisanje se beleži. Zapisi stariji od 60 dana se automatski brišu.
          </p>
        </section>

        {loading ? (
          <div className="card-soft italic text-ink-500">Učitavam istoriju...</div>
        ) : err ? (
          <div className="card-soft text-rose-700">{err}</div>
        ) : entries.length === 0 ? (
          <div className="card-soft italic text-ink-500">
            Još nema izmena ni brisanja.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => {
              const before = e.before as ShiftPayload | null;
              const after = e.after as ShiftPayload | null;
              const changes = diffBlock(before, after);
              return (
                <div key={e.id} className="card-soft">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {e.action === "delete" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          <Trash2 size={12} /> Obrisano
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          <Pencil size={12} /> Izmenjeno
                        </span>
                      )}
                      <span className="text-xs text-ink-500">{e.actor ?? "master"}</span>
                    </div>
                    <span className="text-xs text-ink-500 tabular-nums">
                      {new Date(e.created_at).toLocaleString("sr-RS")}
                    </span>
                  </div>

                  <div className="text-sm text-ink-700">
                    <div className="font-semibold">
                      {summarize(before ?? after)}
                    </div>
                    {e.action === "update" && changes && changes.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {changes.map((c) => (
                          <li key={c.key} className="tabular-nums">
                            <span className="text-ink-500">{c.key}:</span>{" "}
                            <span className="text-rose-700 line-through">
                              {c.before}
                            </span>{" "}
                            →{" "}
                            <span className="text-emerald-700 font-semibold">
                              {c.after}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
