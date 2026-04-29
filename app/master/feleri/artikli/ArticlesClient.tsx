"use client";

import { useEffect, useState, useRef } from "react";
import {
  Search,
  Upload,
  Plus,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase";

interface Article {
  id: string;
  sifra: string;
  barkod: string | null;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  cena: number | null;
  moneta: string | null;
  kasa_sifra: string | null;
}

export default function ArticlesClient() {
  const [list, setList] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(q: string) {
    setLoading(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_feler_articles", {
        p_query: q || null,
        p_proizvodjac: null,
        p_limit: 200,
      });
      if (error) throw new Error(error.message);
      setList((data ?? []) as Article[]);
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

  async function deleteAll() {
    if (
      !confirm(
        "Trajno obrisati SVE artikle iz šifarnika? Ovo se ne može vratiti."
      )
    )
      return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_all_feler_articles");
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
            placeholder="Pretraži po nazivu, šifri, barkodu…"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-ink-900 text-white text-sm font-semibold"
        >
          <Plus size={14} /> Dodaj
        </button>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
        >
          <Upload size={14} /> Import (JSON)
        </button>
      </div>

      {err && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <section className="card-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-ink-500">
            {loading ? "Učitavam…" : `${list.length} artikala`}
          </div>
          {list.length > 0 && (
            <button
              type="button"
              onClick={deleteAll}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Obriši sve
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-ink-400">
            <Loader2 className="mx-auto animate-spin" size={20} />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-ink-400">
            <Package className="mx-auto mb-2" size={28} />
            Nema artikala.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 text-left bg-ink-50">
                  <th className="px-2 py-2">Šifra</th>
                  <th className="px-2 py-2">Naziv</th>
                  <th className="px-2 py-2">Proizvođač</th>
                  <th className="px-2 py-2">Boja / Veličina</th>
                  <th className="px-2 py-2">Barkod</th>
                  <th className="px-2 py-2 text-right">Cena</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t border-ink-100">
                    <td className="px-2 py-2 font-mono text-xs text-ink-700">
                      {a.sifra}
                    </td>
                    <td className="px-2 py-2 font-semibold text-ink-900">
                      {a.naziv}
                    </td>
                    <td className="px-2 py-2 text-ink-700">
                      {a.proizvodjac ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-ink-500">
                      {[a.boja, a.velicina].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-ink-400">
                      {a.barkod ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-700">
                      {a.cena
                        ? `${Number(a.cena).toLocaleString("sr-RS")} ${a.moneta ?? ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && <AddArticleModal onClose={() => setShowAdd(false)} onSaved={() => load(query)} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => load(query)} />
      )}
    </>
  );
}

function Package({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" x2="12" y1="22.08" y2="12" />
    </svg>
  );
}

function AddArticleModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sifra, setSifra] = useState("");
  const [naziv, setNaziv] = useState("");
  const [barkod, setBarkod] = useState("");
  const [proizvodjac, setProizvodjac] = useState("");
  const [boja, setBoja] = useState("");
  const [velicina, setVelicina] = useState("");
  const [cena, setCena] = useState("");
  const [moneta, setMoneta] = useState("RSD");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!sifra || !naziv) {
      setErr("Šifra i naziv su obavezni.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_feler_article", {
        p_sifra: sifra,
        p_barkod: barkod || null,
        p_naziv: naziv,
        p_strano_ime: null,
        p_cena: cena ? Number(cena) : null,
        p_stopa: null,
        p_tip: null,
        p_proizvodjac: proizvodjac || null,
        p_kasa_sifra: null,
        p_moneta: moneta || null,
        p_boja: boja || null,
        p_velicina: velicina || null,
        p_kolicina: null,
        p_jm: null,
      });
      if (error) throw new Error(error.message);
      onSaved();
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-ink-900 mb-4">Novi artikal</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Šifra *
            </label>
            <input
              className="input mt-1"
              value={sifra}
              onChange={(e) => setSifra(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Naziv *
            </label>
            <input
              className="input mt-1"
              value={naziv}
              onChange={(e) => setNaziv(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Barkod
            </label>
            <input
              className="input mt-1"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase">
              Proizvođač
            </label>
            <input
              className="input mt-1"
              value={proizvodjac}
              onChange={(e) => setProizvodjac(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase">
                Boja
              </label>
              <input
                className="input mt-1"
                value={boja}
                onChange={(e) => setBoja(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase">
                Veličina
              </label>
              <input
                className="input mt-1"
                value={velicina}
                onChange={(e) => setVelicina(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase">
                Cena
              </label>
              <input
                type="number"
                className="input mt-1"
                value={cena}
                onChange={(e) => setCena(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-500 uppercase">
                Valuta
              </label>
              <select
                className="input mt-1"
                value={moneta}
                onChange={(e) => setMoneta(e.target.value)}
              >
                <option>RSD</option>
                <option>EUR</option>
                <option>USD</option>
                <option>TRY</option>
              </select>
            </div>
          </div>
          {err && (
            <div className="rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
              {err}
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-2 justify-end">
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
            onClick={save}
            disabled={busy}
            className="btn-primary"
          >
            {busy ? "Snimam…" : "Sačuvaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Type za SheetJS WorkBook (minimalno što koristimo)
interface XLSXLib {
  read: (data: ArrayBuffer, opts: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(
      sheet: unknown,
      opts: { header: 1; defval: null }
    ) => T[];
  };
}

declare global {
  interface Window {
    XLSX?: XLSXLib;
  }
}

const HEADER_MAP: Record<string, string> = {
  sifra: "sifra", "šifra": "sifra", kod: "sifra", "šif": "sifra", id: "sifra",
  barkod: "barkod", "bar kod": "barkod", barcode: "barkod", ean: "barkod",
  naziv: "naziv", "naziv artikla": "naziv", ime: "naziv", opis_dugi: "naziv", product: "naziv",
  "strano ime": "strano_ime", "english name": "strano_ime", "ime na engleskom": "strano_ime",
  proizvodjac: "proizvodjac", "proizvođač": "proizvodjac", brend: "proizvodjac", brand: "proizvodjac", manufacturer: "proizvodjac",
  boja: "boja", karakteristike: "boja", color: "boja",
  velicina: "velicina", "veličina": "velicina", size: "velicina", opis: "velicina",
  cena: "cena", price: "cena", iznos: "cena", "cena rsd": "cena",
  moneta: "moneta", valuta: "moneta", currency: "moneta",
  stopa: "stopa", pdv: "stopa", tax: "stopa", "stopa pdv": "stopa",
  tip: "tip", type: "tip",
  "kasa sifra": "kasa_sifra", "kasa šifra": "kasa_sifra", "kasa kod": "kasa_sifra", kasa: "kasa_sifra", kasakod: "kasa_sifra",
  kolicina: "kolicina", "količina": "kolicina", qty: "kolicina", quantity: "kolicina", kol: "kolicina",
  jm: "jm", "jedinica mere": "jm", unit: "jm",
};

function normalizeHeader(h: string): string | null {
  if (!h) return null;
  const norm = String(h)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (HEADER_MAP[norm]) return HEADER_MAP[norm];
  const first = norm.split(" ")[0];
  if (HEADER_MAP[first]) return HEADER_MAP[first];
  return null;
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function loadXLSX(): Promise<XLSXLib> {
  if (typeof window !== "undefined" && window.XLSX) return window.XLSX;
  return new Promise<XLSXLib>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-lib="xlsx"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error("XLSX globalna nije dostupna posle učitavanja."));
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.dataset.lib = "xlsx";
    s.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("XLSX globalna nije dostupna."));
    };
    s.onerror = () => reject(new Error("Ne mogu da učitam XLSX biblioteku."));
    document.head.appendChild(s);
  });
}

function ImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"xlsx" | "json">("xlsx");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detectedFields, setDetectedFields] = useState<string[] | null>(null);

  async function doXlsxImport() {
    if (!file) {
      setErr("Izaberi .xlsx ili .xls fajl.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    setDetectedFields(null);
    setProgress(null);

    try {
      // 1) Učitaj XLSX biblioteku (CDN, lazy)
      const xlsx = await loadXLSX();

      // 2) Pročitaj fajl
      const buf = await file.arrayBuffer();
      const wb = xlsx.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Excel fajl nema list sa podacima.");

      const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
      });
      if (rows.length === 0) throw new Error("Fajl je prazan.");

      // 3) Auto-detekcija header reda
      let headerRowIdx = -1;
      let headerMap: Map<number, string> = new Map();
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] ?? [];
        const m = new Map<number, string>();
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (cell == null) continue;
          const k = normalizeHeader(String(cell));
          if (k) m.set(j, k);
        }
        const hasSifra = Array.from(m.values()).includes("sifra");
        if (m.size >= 2 && hasSifra) {
          headerRowIdx = i;
          headerMap = m;
          break;
        }
        if (m.size >= 3 && headerRowIdx === -1) {
          headerRowIdx = i;
          headerMap = m;
        }
      }

      if (headerRowIdx === -1) {
        throw new Error(
          "Ne prepoznajem zaglavlja. Treba kolone: šifra, naziv, barkod, proizvođač, boja, veličina, cena."
        );
      }

      setDetectedFields(Array.from(headerMap.values()));

      // 4) Mapuj redove i upsertuj jedan po jedan
      const dataRows = rows
        .slice(headerRowIdx + 1)
        .filter((r) => r && r.some((v) => v != null && v !== ""));

      setProgress({ current: 0, total: dataRows.length });

      const supabase = createSupabaseBrowser();
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let idx = 0; idx < dataRows.length; idx++) {
        const row = dataRows[idx];
        const article: Record<string, unknown> = {};
        headerMap.forEach((key, colIdx) => {
          article[key] = row[colIdx];
        });

        const sifra = parseStr(article.sifra);
        const naziv = parseStr(article.naziv);
        if (!sifra || !naziv) {
          skipped++;
          setProgress({ current: idx + 1, total: dataRows.length });
          continue;
        }

        const { error } = await supabase.rpc("upsert_feler_article", {
          p_sifra: sifra,
          p_barkod: parseStr(article.barkod),
          p_naziv: naziv,
          p_strano_ime: parseStr(article.strano_ime),
          p_cena: parseNum(article.cena),
          p_stopa: parseNum(article.stopa),
          p_tip: parseStr(article.tip),
          p_proizvodjac: parseStr(article.proizvodjac),
          p_kasa_sifra: parseStr(article.kasa_sifra),
          p_moneta: parseStr(article.moneta),
          p_boja: parseStr(article.boja),
          p_velicina: parseStr(article.velicina),
          p_kolicina: parseNum(article.kolicina),
          p_jm: parseStr(article.jm),
        });

        if (error) {
          skipped++;
          if (errors.length < 5) errors.push(`Red ${headerRowIdx + idx + 2}: ${error.message}`);
        } else {
          imported++;
        }
        setProgress({ current: idx + 1, total: dataRows.length });
      }

      setMsg(
        `Uvezeno: ${imported}. Preskočeno: ${skipped}. ${errors.length > 0 ? "Prve greške: " + errors.join("; ") : ""}`
      );
      if (imported > 0) {
        setTimeout(() => {
          onDone();
          onClose();
        }, 3000);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function doJsonImport() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      let arr: unknown;
      try {
        arr = JSON.parse(text);
      } catch {
        throw new Error("JSON je neispravan.");
      }
      if (!Array.isArray(arr)) throw new Error("Očekuje niz objekata.");

      const supabase = createSupabaseBrowser();
      let imported = 0;
      let failed = 0;
      for (const item of arr as Array<Record<string, unknown>>) {
        const sifra = String(item.sifra ?? item["šifra"] ?? "").trim();
        const naziv = String(item.naziv ?? "").trim();
        if (!sifra || !naziv) {
          failed++;
          continue;
        }
        const { error } = await supabase.rpc("upsert_feler_article", {
          p_sifra: sifra,
          p_barkod: (item.barkod as string) || null,
          p_naziv: naziv,
          p_strano_ime: (item.strano_ime as string) || null,
          p_cena: item.cena != null ? Number(item.cena) : null,
          p_stopa: item.stopa != null ? Number(item.stopa) : null,
          p_tip: (item.tip as string) || null,
          p_proizvodjac: (item.proizvodjac as string) || null,
          p_kasa_sifra: (item.kasa_sifra as string) || null,
          p_moneta: (item.moneta as string) || null,
          p_boja: (item.boja as string) || null,
          p_velicina: (item.velicina as string) || null,
          p_kolicina: item.kolicina != null ? Number(item.kolicina) : null,
          p_jm: (item.jm as string) || null,
        });
        if (error) failed++;
        else imported++;
      }
      setMsg(`Uvezeno: ${imported}, neuspešno: ${failed}.`);
      if (imported > 0) {
        setTimeout(() => {
          onDone();
          onClose();
        }, 1500);
      }
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-ink-900 mb-3">Import artikala</h3>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 bg-ink-50 p-1 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setMode("xlsx")}
            className={
              mode === "xlsx"
                ? "px-3 py-1.5 rounded-md bg-white shadow-sm text-sm font-semibold text-ink-900"
                : "px-3 py-1.5 rounded-md text-sm font-semibold text-ink-500"
            }
          >
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => setMode("json")}
            className={
              mode === "json"
                ? "px-3 py-1.5 rounded-md bg-white shadow-sm text-sm font-semibold text-ink-900"
                : "px-3 py-1.5 rounded-md text-sm font-semibold text-ink-500"
            }
          >
            JSON
          </button>
        </div>

        {mode === "xlsx" ? (
          <>
            <p className="text-xs text-ink-500 mb-3 leading-relaxed">
              Sistem auto-prepoznaje srpska zaglavlja: <b>šifra, barkod, naziv,
              proizvođač, boja/karakteristike, veličina/opis, cena, kasa, moneta,
              stopa, količina, jm</b>. Header može biti u bilo kom od prvih 10
              redova. Šifra i naziv obavezni — redovi bez njih se preskaču.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErr(null);
                setMsg(null);
                setDetectedFields(null);
              }}
              className="block w-full text-sm text-ink-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-ink-900 file:text-white hover:file:bg-ink-800 cursor-pointer"
            />
            {file && (
              <div className="mt-2 text-xs text-ink-500">
                Izabrano: <b>{file.name}</b> ({(file.size / 1024).toFixed(0)} KB)
              </div>
            )}
            {detectedFields && detectedFields.length > 0 && (
              <div className="mt-3 rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900">
                <b>Prepoznate kolone:</b> {detectedFields.join(", ")}
              </div>
            )}
            {progress && (
              <div className="mt-3">
                <div className="text-xs text-ink-700 mb-1.5">
                  Uvozim: {progress.current} / {progress.total}
                </div>
                <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink-900 transition-all"
                    style={{
                      width: `${
                        progress.total > 0
                          ? (progress.current / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-ink-500 mb-3 leading-relaxed">
              Pejstuj niz objekata. Polja: <code>sifra</code> i{" "}
              <code>naziv</code> obavezna. Opciona: <code>barkod, proizvodjac,
              boja, velicina, cena, moneta, kasa_sifra, kolicina, jm, tip,
              stopa, strano_ime</code>.
            </p>
            <textarea
              rows={10}
              className="input font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='[{"sifra": "12345", "naziv": "Bluza", "barkod": "...", "proizvodjac": "..."}]'
            />
          </>
        )}

        {msg && (
          <div className="mt-3 rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
            {msg}
          </div>
        )}
        {err && (
          <div className="mt-3 rounded bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-900">
            {err}
          </div>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">
            Otkaži
          </button>
          <button
            type="button"
            onClick={mode === "xlsx" ? doXlsxImport : doJsonImport}
            disabled={
              busy || (mode === "xlsx" ? !file : !text.trim())
            }
            className="btn-primary"
          >
            {busy ? "Uvozim…" : "Uvezi"}
          </button>
        </div>
      </div>
    </div>
  );
}
