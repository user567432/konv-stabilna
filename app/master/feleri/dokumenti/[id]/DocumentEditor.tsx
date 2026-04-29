"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Trash2,
  X,
  Download,
  Loader2,
  AlertTriangle,
  Pencil,
  TriangleAlert,
  CheckSquare,
  Camera,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import ImageUploader from "@/components/ImageUploader";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { FelerDoc, DocArticleRow } from "./page";

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

const STATUSI = [
  { value: "U procesu", color: "bg-sky-100 text-sky-900" },
  { value: "Vraćeno sa novcem", color: "bg-emerald-100 text-emerald-900" },
  { value: "Vraćeno kao zamjena", color: "bg-purple-100 text-purple-900" },
  { value: "Ostavljeno na popravku", color: "bg-amber-100 text-amber-900" },
  { value: "Odbijeno", color: "bg-rose-100 text-rose-900" },
];

const VALUTE = ["RSD", "EUR", "USD", "TRY"];

interface ArticleSearchResult {
  id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  barkod: string | null;
}

export default function DocumentEditor({
  doc,
  initialArticles,
}: {
  doc: FelerDoc;
  initialArticles: DocArticleRow[];
}) {
  const [articles, setArticles] = useState<DocArticleRow[]>(initialArticles);
  const [showAddArticle, setShowAddArticle] = useState(false);
  const [showFromFeleri, setShowFromFeleri] = useState(false);
  const [editingArticle, setEditingArticle] = useState<DocArticleRow | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, DocArticleRow[]>();
    articles.forEach((a) => {
      const key = a.proizvodjac ?? "Bez proizvođača";
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [articles]);

  async function reload() {
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_doc_articles", {
        p_doc_id: doc.id,
      });
      if (error) throw new Error(error.message);
      setArticles((data ?? []) as DocArticleRow[]);
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Obrisati ovaj artikal iz dokumenta?")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_doc_article", { p_id: id });
      if (error) throw new Error(error.message);
      setArticles((arr) => arr.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function toggleCekirano(row: DocArticleRow) {
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("update_doc_article", {
        p_id: row.id,
        p_cekirano: !row.cekirano,
      });
      if (error) throw new Error(error.message);
      setArticles((arr) =>
        arr.map((a) => (a.id === row.id ? { ...a, cekirano: !a.cekirano } : a))
      );
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function checkAllInGroup(rows: DocArticleRow[]) {
    const toCheck = rows.filter((r) => !r.cekirano);
    if (toCheck.length === 0) return;
    try {
      const supabase = createSupabaseBrowser();
      for (const r of toCheck) {
        await supabase.rpc("update_doc_article", {
          p_id: r.id,
          p_cekirano: true,
        });
      }
      setArticles((arr) =>
        arr.map((a) =>
          toCheck.find((c) => c.id === a.id) ? { ...a, cekirano: true } : a
        )
      );
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  function exportLogik() {
    window.open(`/api/feleri/dokumenti/${doc.id}/export-logik`, "_blank");
  }

  return (
    <div className="space-y-6">
      <section className="card-soft">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {doc.naziv}
            </h1>
            <p className="text-xs text-ink-500 mt-1">
              {doc.datum} · {articles.length} artikala
            </p>
            {doc.napomena && (
              <p className="text-sm text-ink-500 mt-1.5 italic">{doc.napomena}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportLogik}
              disabled={articles.length === 0}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Download size={14} /> Izvezi u Logik
            </button>
          </div>
        </div>
      </section>

      {globalErr && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{globalErr}</span>
          <button
            type="button"
            onClick={() => setGlobalErr(null)}
            className="ml-auto text-rose-700 text-xs font-semibold"
          >
            Zatvori
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowAddArticle(true)}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-ink-900 text-white text-sm font-semibold"
        >
          <Search size={14} /> Pretraži i dodaj artikal
        </button>
        <button
          type="button"
          onClick={() => setShowFromFeleri(true)}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
        >
          <TriangleAlert size={14} /> Iz felera
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="card-soft text-center py-12 text-ink-400">
          Nema artikala u dokumentu. Klikni „Pretraži i dodaj".
        </div>
      ) : (
        grouped.map(([proizvodjac, list]) => (
          <section key={proizvodjac} className="card-soft">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-xs uppercase tracking-wider font-bold text-ink-500">
                {proizvodjac} ·{" "}
                <span className="text-ink-700 normal-case">
                  {list.length} artikala
                </span>
              </h3>
              {list.some((r) => !r.cekirano) && (
                <button
                  type="button"
                  onClick={() => checkAllInGroup(list)}
                  className="text-xs h-8 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold inline-flex items-center gap-1"
                >
                  <CheckSquare size={12} /> Čekiraj sve
                </button>
              )}
            </div>
            <div className="space-y-2">
              {list.map((row) => {
                const status = STATUSI.find((s) => s.value === row.status);
                return (
                  <div
                    key={row.id}
                    className={clsx(
                      "flex flex-wrap items-start gap-3 p-3 rounded-xl border transition",
                      row.cekirano
                        ? "bg-ink-50 border-ink-200 opacity-60"
                        : "bg-white border-ink-100"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={row.cekirano}
                      onChange={() => toggleCekirano(row)}
                      className="mt-1.5 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={clsx(
                          "font-semibold text-ink-900",
                          row.cekirano && "line-through"
                        )}
                      >
                        {row.naziv}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        <span className="font-mono">{row.sifra}</span>
                        {row.boja && ` · ${row.boja}`}
                        {row.velicina && ` · ${row.velicina}`}
                        {` · ${row.kolicina} kom`}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-ink-100 text-ink-700 font-semibold">
                          {row.tip_ostecenja}
                        </span>
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                            status?.color ?? "bg-ink-100 text-ink-900"
                          )}
                        >
                          {row.status}
                        </span>
                        {row.iznos_povracaja != null &&
                          row.valuta_povracaja && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 font-semibold tabular-nums">
                              {Number(row.iznos_povracaja).toLocaleString(
                                "sr-RS"
                              )}{" "}
                              {row.valuta_povracaja}
                            </span>
                          )}
                        {row.zamena_tekst && (
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-900 italic">
                            zamena: {row.zamena_tekst}
                          </span>
                        )}
                      </div>
                      {row.napomena && (
                        <div className="text-xs text-ink-500 mt-1.5 italic">
                          {row.napomena}
                        </div>
                      )}
                      {row.slike && row.slike.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {row.slike.slice(0, 4).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-12 h-12 rounded border border-ink-200 overflow-hidden bg-ink-50"
                            >
                              <img
                                src={url}
                                alt="slika"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                          {row.slike.length > 4 && (
                            <div className="w-12 h-12 rounded border border-ink-200 bg-ink-100 flex items-center justify-center text-xs font-bold text-ink-700">
                              +{row.slike.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingArticle(row)}
                        className="p-1.5 rounded hover:bg-ink-100 text-ink-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {showAddArticle && (
        <ArticleSearchModal
          documentId={doc.id}
          onClose={() => setShowAddArticle(false)}
          onAdded={() => {
            setShowAddArticle(false);
            reload();
          }}
        />
      )}

      {showFromFeleri && (
        <FromFeleriModal
          documentId={doc.id}
          onClose={() => setShowFromFeleri(false)}
          onAdded={() => {
            setShowFromFeleri(false);
            reload();
          }}
        />
      )}

      {editingArticle && (
        <EditArticleModal
          row={editingArticle}
          onClose={() => setEditingArticle(null)}
          onSaved={() => {
            setEditingArticle(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ArticleSearchModal({
  documentId,
  onClose,
  onAdded,
}: {
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kolicina, setKolicina] = useState("1");
  const [tip, setTip] = useState(TIPOVI_OSTECENJA[0]);
  const [napomena, setNapomena] = useState("");
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
    setLoading(true);
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
    } finally {
      setLoading(false);
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
      const { error } = await supabase.rpc("add_doc_article", {
        p_document_id: documentId,
        p_article_id: selectedId,
        p_kolicina: Number(kolicina) || 1,
        p_tip_ostecenja: tip,
        p_status: "U procesu",
        p_napomena: napomena.trim() || null,
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
          <h3 className="font-bold text-ink-900">Dodaj artikal u dokument</h3>
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
                placeholder="Pretraži po nazivu, šifri, barkodu…"
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
              title="Skeniraj barkod"
            >
              <Camera size={14} /> Skeniraj
            </button>
          </div>
          {loading ? (
            <div className="text-center py-3 text-ink-400">
              <Loader2 className="mx-auto animate-spin" size={20} />
            </div>
          ) : results.length === 0 ? (
            <div className="text-xs text-ink-400 italic text-center py-3">
              Kucaj u polje da pretražiš.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-900 truncate">
                        {r.naziv}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        <span className="font-mono">{r.sifra}</span>
                        {r.proizvodjac && ` · ${r.proizvodjac}`}
                        {r.boja && ` · ${r.boja}`}
                        {r.velicina && ` · ${r.velicina}`}
                      </div>
                    </div>
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
                  placeholder="Opciono"
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
            {busy ? "Dodajem…" : "Dodaj artikal"}
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

function EditArticleModal({
  row,
  onClose,
  onSaved,
}: {
  row: DocArticleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kolicina, setKolicina] = useState(String(row.kolicina));
  const [tip, setTip] = useState(row.tip_ostecenja);
  const [status, setStatus] = useState(row.status);
  const [napomena, setNapomena] = useState(row.napomena ?? "");
  const [iznos, setIznos] = useState(
    row.iznos_povracaja != null ? String(row.iznos_povracaja) : ""
  );
  const [valuta, setValuta] = useState(row.valuta_povracaja ?? "RSD");
  const [zamena, setZamena] = useState(row.zamena_tekst ?? "");
  const [slike, setSlike] = useState<string[]>(row.slike ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("update_doc_article", {
        p_id: row.id,
        p_kolicina: Number(kolicina) || 1,
        p_tip_ostecenja: tip,
        p_status: status,
        p_napomena: napomena.trim() || null,
        p_iznos_povracaja:
          status === "Vraćeno sa novcem" && iznos !== ""
            ? Number(iznos)
            : null,
        p_valuta_povracaja:
          status === "Vraćeno sa novcem" ? valuta : null,
        p_zamena_artikal_id: null,
        p_zamena_tekst:
          status === "Vraćeno kao zamjena" ? zamena.trim() || null : null,
        p_cekirano: null,
        p_slike: slike,
      });
      if (error) throw new Error(error.message);
      onSaved();
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-ink-900">Izmena</h3>
            <div className="text-xs text-ink-500">{row.naziv}</div>
          </div>
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
            <label className="text-xs font-bold text-ink-500 uppercase mb-1.5 block">
              Status
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {STATUSI.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={clsx(
                    "px-3 py-2 rounded-lg border-2 text-left text-sm font-semibold transition",
                    status === s.value
                      ? "border-ink-900 " + s.color
                      : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                  )}
                >
                  {s.value}
                </button>
              ))}
            </div>
          </div>

          {status === "Vraćeno sa novcem" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-bold text-ink-500 uppercase">
                  Iznos povraćaja
                </label>
                <input
                  type="number"
                  className="input mt-1"
                  value={iznos}
                  onChange={(e) => setIznos(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase">
                  Valuta
                </label>
                <select
                  className="input mt-1"
                  value={valuta}
                  onChange={(e) => setValuta(e.target.value)}
                >
                  {VALUTE.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {status === "Vraćeno kao zamjena" && (
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase">
                Zamenski artikal (tekst)
              </label>
              <input
                className="input mt-1"
                value={zamena}
                onChange={(e) => setZamena(e.target.value)}
                placeholder="Npr. Bluza M, šifra 12345"
              />
            </div>
          )}

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
              folder="doc-articles"
              max={6}
              disabled={busy}
            />
          </div>

          {err && (
            <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
              {err}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/40 sticky bottom-0">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Otkaži
          </button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Snimam…" : "Sačuvaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FelerItem {
  id: string;
  article_id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  kolicina: number;
  tip_ostecenja: string;
}

function FromFeleriModal({
  documentId,
  onClose,
  onAdded,
}: {
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [feleri, setFeleri] = useState<FelerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data, error } = await supabase.rpc("list_feleri_simple", {
          p_query: null,
        });
        if (error) throw new Error(error.message);
        if (!cancelled) setFeleri((data ?? []) as FelerItem[]);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Greška.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return feleri;
    const q = query.toLowerCase();
    return feleri.filter(
      (f) =>
        f.naziv.toLowerCase().includes(q) ||
        f.sifra.toLowerCase().includes(q) ||
        (f.proizvodjac ?? "").toLowerCase().includes(q)
    );
  }, [feleri, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, FelerItem[]>();
    filtered.forEach((f) => {
      const key = f.proizvodjac ?? "Bez proizvođača";
      const arr = m.get(key) ?? [];
      arr.push(f);
      m.set(key, arr);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((f) => f.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function add() {
    if (selected.size === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("bulk_add_doc_articles_from_feleri", {
        p_document_id: documentId,
        p_feler_ids: Array.from(selected),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-ink-900">Dodaj iz felera</h3>
            <p className="text-xs text-ink-500">
              Štikliraj šta želiš da prebaciš u dokument. Posle obrade u
              dokumentu, feler iz liste se automatski briše/smanji.
            </p>
          </div>
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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="text"
                placeholder="Pretraži po artiklu, šifri…"
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={filtered.length === 0}
              className="text-xs h-9 px-3 rounded-lg bg-ink-50 hover:bg-ink-100 text-ink-700 font-semibold"
            >
              Označi sve
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs h-9 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
              >
                Skini ({selected.size})
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-ink-400">
              <Loader2 className="mx-auto animate-spin" size={20} />
            </div>
          ) : feleri.length === 0 ? (
            <div className="text-center py-12 text-ink-400 italic">
              Nema prijavljenih felera. Idi u Feleri sekciju i prijavi prvo
              defekte iz radnji.
            </div>
          ) : (
            grouped.map(([proizvodjac, items]) => (
              <div key={proizvodjac} className="rounded-xl bg-ink-50/40 p-3">
                <div className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-2">
                  {proizvodjac} · {items.length} felera
                </div>
                <div className="space-y-1.5">
                  {items.map((f) => {
                    const isSel = selected.has(f.id);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => toggle(f.id)}
                        className={clsx(
                          "w-full text-left flex items-start gap-3 p-2.5 rounded-lg border-2 transition",
                          isSel
                            ? "border-ink-900 bg-white"
                            : "border-transparent bg-white hover:border-ink-200"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(f.id)}
                          className="mt-1 w-4 h-4"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink-900 truncate">
                            {f.naziv}
                          </div>
                          <div className="text-[11px] text-ink-500 mt-0.5">
                            <span className="font-mono">{f.sifra}</span>
                            {f.boja && ` · ${f.boja}`}
                            {f.velicina && ` · ${f.velicina}`}
                            {` · ${f.kolicina} kom`}
                          </div>
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                            {f.tip_ostecenja}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
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
            disabled={busy || selected.size === 0}
            className="btn-primary"
          >
            {busy ? "Dodajem…" : `Dodaj ${selected.size} u dokument`}
          </button>
        </div>
      </div>
    </div>
  );
}
