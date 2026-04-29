"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Search,
  AlertTriangle,
  Loader2,
  Trash2,
  X,
  TriangleAlert,
  Camera,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import ImageUploader from "@/components/ImageUploader";
import BarcodeScanner from "@/components/BarcodeScanner";

const TIPOVI_OSTECENJA = [
  "Pocepana tkanina",
  "Fleka",
  "Popucali šavovi",
  "Boja izbledela",
  "Rajsferšlus pokvaren",
  "Dugme nedostaje",
  "Materijal oštećen",
  "Otpala boja",
  "Deformisano",
  "Drugi defekt",
];

interface FelerRow {
  id: string;
  article_id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  kolicina: number;
  tip_ostecenja: string;
  napomena: string | null;
  created_at: string;
}

interface ArticleSearchResult {
  id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
}

export default function FeleriClient() {
  const [list, setList] = useState<FelerRow[]>([]);
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
      const { data, error } = await supabase.rpc("list_feleri_simple", {
        p_query: q || null,
      });
      if (error) throw new Error(error.message);
      setList((data ?? []) as FelerRow[]);
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

  async function deleteOne(id: string) {
    if (!confirm("Obrisati ovaj feler?")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_feler", { p_id: id });
      if (error) throw new Error(error.message);
      setList((arr) => arr.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function deleteAll() {
    if (
      !confirm(
        "Trajno obrisati SVE felere? Ovo se ne može vratiti — preporučujem da prvo prebaciš u dokument reklamacije."
      )
    )
      return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_all_feleri");
      if (error) throw new Error(error.message);
      load(query);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, FelerRow[]>();
    list.forEach((f) => {
      const key = f.proizvodjac ?? "Bez proizvođača";
      const arr = m.get(key) ?? [];
      arr.push(f);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [list]);

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
            placeholder="Pretraži po artiklu, šifri…"
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
          <Plus size={14} /> Dodaj feler
        </button>
        {list.length > 0 && (
          <button
            type="button"
            onClick={deleteAll}
            className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold"
          >
            <Trash2 size={14} /> Obriši sve
          </button>
        )}
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
          <TriangleAlert className="mx-auto mb-3 text-ink-300" size={40} />
          <p className="text-ink-500">Nema prijavljenih felera.</p>
        </div>
      ) : (
        grouped.map(([proizvodjac, items]) => (
          <section key={proizvodjac} className="card-soft">
            <h3 className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              {proizvodjac} ·{" "}
              <span className="text-ink-700 normal-case">
                {items.length} felera
              </span>
            </h3>
            <div className="space-y-2">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start gap-3 p-3 rounded-xl border border-ink-100 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900">
                      {row.naziv}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      <span className="font-mono">{row.sifra}</span>
                      {row.boja && ` · ${row.boja}`}
                      {row.velicina && ` · ${row.velicina}`}
                      {` · ${row.kolicina} kom`}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                        {row.tip_ostecenja}
                      </span>
                    </div>
                    {row.napomena && (
                      <div className="text-xs text-ink-500 mt-1.5 italic">
                        {row.napomena}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteOne(row.id)}
                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {showAdd && (
        <AddFelerModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load(query);
          }}
        />
      )}
    </>
  );
}

function AddFelerModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kolicina, setKolicina] = useState("1");
  const [tip, setTip] = useState(TIPOVI_OSTECENJA[0]);
  const [napomena, setNapomena] = useState("");
  const [slike, setSlike] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleBarcodeScan(barkod: string) {
    setShowScanner(false);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("find_feler_article_by_barkod", { p_barkod: barkod })
        .single<ArticleSearchResult>();
      if (error || !data) {
        setErr(`Artikal sa barkodom ${barkod} nije pronađen u šifarniku.`);
        return;
      }
      setSelectedId(data.id);
      setQuery(data.naziv);
      setResults([data]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function search(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_feler_articles", {
        p_query: q,
        p_proizvodjac: null,
        p_limit: 50,
      });
      if (error) throw new Error(error.message);
      setResults((data ?? []) as ArticleSearchResult[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  function onQuery(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 200);
  }

  async function add() {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("create_feler", {
        p_article_id: selectedId,
        p_kolicina: Number(kolicina) || 1,
        p_tip_ostecenja: tip,
        p_napomena: napomena.trim() || null,
        p_slike: slike,
      });
      if (error) throw new Error(error.message);
      onAdded();
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-bold text-ink-900">Novi feler</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded hover:bg-ink-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="text"
                placeholder="Pretraži artikal po nazivu, šifri…"
                className="input pl-10"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="h-10 px-3 rounded-lg bg-ink-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
              title="Skeniraj barkod kamerom"
            >
              <Camera size={14} /> Skeniraj
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-48 overflow-y-auto -mx-1 px-1 space-y-1">
              {results.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={clsx(
                    "w-full text-left px-3 py-2 rounded-lg border-2 transition",
                    selectedId === r.id
                      ? "border-ink-900 bg-ink-50"
                      : "border-transparent hover:bg-ink-50"
                  )}
                >
                  <div className="text-sm font-semibold text-ink-900 truncate">
                    {r.naziv}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    <span className="font-mono">{r.sifra}</span>
                    {r.proizvodjac && ` · ${r.proizvodjac}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedId && (
            <div className="border-t border-ink-100 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-ink-500 uppercase">
                    Količina
                  </label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={kolicina}
                    onChange={(e) => setKolicina(e.target.value)}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-500 uppercase">
                    Tip oštećenja
                  </label>
                  <select
                    className="input mt-1"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                  >
                    {TIPOVI_OSTECENJA.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase">
                  Napomena
                </label>
                <textarea
                  rows={2}
                  className="input mt-1"
                  value={napomena}
                  onChange={(e) => setNapomena(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase mb-1 block">
                  Slike defekta
                </label>
                <ImageUploader
                  value={slike}
                  onChange={setSlike}
                  folder="feleri"
                  max={6}
                  disabled={busy}
                />
              </div>
            </div>
          )}

          {err && (
            <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
              {err}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/40 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost"
          >
            Otkaži
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy || !selectedId}
            className="btn-primary"
          >
            {busy ? "Dodajem…" : "Dodaj feler"}
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onClose={() => setShowScanner(false)}
          onScan={handleBarcodeScan}
        />
      )}
    </div>
  );
}
