"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  AlertTriangle,
  Loader2,
  Trash2,
  FileBox,
  Calendar,
  X,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { formatDateSr } from "@/lib/format";

interface DocRow {
  id: string;
  naziv: string;
  datum: string;
  napomena: string | null;
  total_articles: number;
  pending_count: number;
  processed_count: number;
  created_at: string;
  updated_at: string;
}

export default function DokumentiClient() {
  const [list, setList] = useState<DocRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(q: string) {
    setLoading(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_feler_documents", {
        p_query: q || null,
      });
      if (error) throw new Error(error.message);
      setList((data ?? []) as DocRow[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function onQueryChange(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(v), 200);
  }

  async function deleteDoc(id: string) {
    if (!confirm("Obrisati dokument sa svim artiklima?")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_feler_document", { p_id: id });
      if (error) throw new Error(error.message);
      load(query);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            placeholder="Pretraži po nazivu dokumenta…"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-ink-900 text-white text-sm font-semibold"
        >
          <Plus size={14} /> Novi dokument
        </button>
      </div>

      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-ink-400">
          <Loader2 className="mx-auto animate-spin" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="card-soft text-center py-16">
          <FileBox className="mx-auto mb-3 text-ink-300" size={40} />
          <p className="text-ink-500">Nema dokumenata. Klikni „Novi dokument".</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((d) => (
            <Link
              key={d.id}
              href={`/master/feleri/dokumenti/${d.id}`}
              className="card-soft hover:border-ink-900 hover:-translate-y-0.5 transition-all block"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink-900 truncate">{d.naziv}</div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1">
                    <Calendar size={11} /> {formatDateSr(d.datum)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    deleteDoc(d.id);
                  }}
                  className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px] flex-wrap">
                <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 font-semibold">
                  {d.total_articles} art.
                </span>
                {d.pending_count > 0 && (
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-semibold">
                    {d.pending_count} u procesu
                  </span>
                )}
                {d.processed_count > 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold">
                    {d.processed_count} obrađeno
                  </span>
                )}
              </div>
              {d.napomena && (
                <div className="text-xs text-ink-500 mt-2 italic line-clamp-2">
                  {d.napomena}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {showAdd && (
        <CreateDocModal
          onClose={() => setShowAdd(false)}
          onCreated={() => load(query)}
        />
      )}
    </>
  );
}

function CreateDocModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [naziv, setNaziv] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [napomena, setNapomena] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!naziv.trim()) {
      setErr("Naziv dokumenta je obavezan.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("create_feler_document", {
        p_naziv: naziv.trim(),
        p_datum: datum,
        p_napomena: napomena.trim() || null,
      });
      if (error) throw new Error(error.message);
      onCreated();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink-900">Novi dokument</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded hover:bg-ink-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Naziv *
            </label>
            <input
              className="input mt-1"
              value={naziv}
              onChange={(e) => setNaziv(e.target.value)}
              placeholder="Npr. Reklamacije DIZAYN — april 2026"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Datum
            </label>
            <input
              type="date"
              className="input mt-1"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Napomena
            </label>
            <textarea
              rows={3}
              className="input mt-1"
              value={napomena}
              onChange={(e) => setNapomena(e.target.value)}
              placeholder="Opciono"
            />
          </div>
          {err && (
            <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
              {err}
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Otkaži
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Snimam…" : "Kreiraj"}
          </button>
        </div>
      </div>
    </div>
  );
}
