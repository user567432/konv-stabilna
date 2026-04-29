"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  Pencil,
  RefreshCw,
  Search,
  ArrowUpDown,
  Download,
  Undo2,
  Redo2,
  Printer,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { formatRSD } from "@/lib/format";
import type { InvoiceFull, InvoiceArticle } from "./page";

interface Props {
  invoice: InvoiceFull;
  initialArticles: InvoiceArticle[];
}

interface Rates {
  usdEur: number;
  eurRsd: number;
  popust: number;
  markup: number;
}

const DEFAULT_RATES: Rates = {
  usdEur: 0.93,
  eurRsd: 117.5,
  popust: 5,
  markup: 50,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function InvoiceEditor({ invoice, initialArticles }: Props) {
  const router = useRouter();
  const [articles, setArticles] = useState<InvoiceArticle[]>(initialArticles);
  const [rates, setRates] = useState<Rates>({
    ...DEFAULT_RATES,
    ...(invoice.rates_json as Partial<Rates>),
  });
  const [customName, setCustomName] = useState(invoice.custom_name ?? "");
  const [editingName, setEditingName] = useState(false);
  const [supplierName, setSupplierName] = useState(invoice.supplier_name ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date ?? "");
  const [headerStatus, setHeaderStatus] = useState<SaveStatus>("idle");
  const [rowStatus, setRowStatus] = useState<Map<string, SaveStatus>>(new Map());
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const headerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowDebounce = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const koeficijent = useMemo(() => {
    const popust = rates.popust ?? 0;
    const markup = rates.markup ?? 0;
    return (1 - popust / 100) * rates.usdEur * rates.eurRsd * (1 + markup / 100);
  }, [rates]);

  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<{
    col: keyof InvoiceArticle | "total";
    dir: "asc" | "desc";
  } | null>(null);
  const [ratesBusy, setRatesBusy] = useState(false);

  // Undo/redo istorija — čuvamo snapshote articles array-a
  const undoStack = useRef<InvoiceArticle[][]>([]);
  const redoStack = useRef<InvoiceArticle[][]>([]);
  const [, forceRerender] = useState(0);
  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: string;
  } | null>(null);

  async function undo() {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(JSON.parse(JSON.stringify(articles)));
    setArticles(prev);
    // Server sync — bulk update
    try {
      const supabase = createSupabaseBrowser();
      for (const a of prev) {
        await supabase.rpc("upsert_invoice_article", {
          p_id: a.id,
          p_invoice_id: invoice.id,
          p_position: a.position,
          p_model: a.model,
          p_tip: a.tip,
          p_boja: a.boja,
          p_kolicina: Number(a.kolicina) || 0,
          p_usd: Number(a.usd) || 0,
          p_rvel: Number(a.rvel) || 0,
        });
      }
    } catch {
      // best effort
    }
    forceRerender((n) => n + 1);
  }

  async function redo() {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(JSON.parse(JSON.stringify(articles)));
    setArticles(next);
    forceRerender((n) => n + 1);
  }

  // Globalni Ctrl+Z / Ctrl+Y handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Ne presretni undo unutar input polja (nativno textarea undo radi)
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z")
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let arr = articles;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      arr = arr.filter(
        (a) =>
          (a.model ?? "").toLowerCase().includes(q) ||
          (a.tip ?? "").toLowerCase().includes(q) ||
          (a.boja ?? "").toLowerCase().includes(q)
      );
    }
    if (sortBy) {
      const sorted = [...arr];
      sorted.sort((a, b) => {
        let aVal: number | string;
        let bVal: number | string;
        if (sortBy.col === "total") {
          aVal = (Number(a.kolicina) || 0) * (Number(a.usd) || 0);
          bVal = (Number(b.kolicina) || 0) * (Number(b.usd) || 0);
        } else {
          aVal =
            (a[sortBy.col] as string | number | null) ?? (typeof a[sortBy.col] === "number" ? 0 : "");
          bVal =
            (b[sortBy.col] as string | number | null) ?? (typeof b[sortBy.col] === "number" ? 0 : "");
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortBy.dir === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortBy.dir === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
      arr = sorted;
    }
    return arr;
  }, [articles, filterText, sortBy]);

  function toggleSort(col: keyof InvoiceArticle | "total") {
    setSortBy((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }

  async function autoFetchRates() {
    setRatesBusy(true);
    try {
      const res = await fetch("/api/rates");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Greška.");
      setRates((r) => ({
        ...r,
        usdEur: Number(j.usdEur),
        eurRsd: Number(j.eurRsd),
      }));
    } catch (e: unknown) {
      setGlobalErr(
        e instanceof Error ? `Auto kurs: ${e.message}` : "Auto kurs nije uspeo."
      );
    } finally {
      setRatesBusy(false);
    }
  }

  function exportCSV() {
    const header = [
      "#", "Model", "Tip", "Boja", "Količina",
      "USD", "EUR", "RSD orij.", "RVEL", "Ukupno USD"
    ];
    const rows = articles.map((a, i) => {
      const k = Number(a.kolicina) || 0;
      const u = Number(a.usd) || 0;
      return [
        i + 1,
        a.model ?? "",
        a.tip ?? "",
        a.boja ?? "",
        k.toFixed(2),
        u.toFixed(2),
        (u * rates.usdEur).toFixed(2),
        Math.round(u * koeficijent),
        (Number(a.rvel) || 0).toFixed(2),
        (k * u).toFixed(2),
      ];
    });
    const csv =
      header.join(";") +
      "\n" +
      rows
        .map((r) =>
          r
            .map((v) => {
              const s = String(v);
              if (s.includes(";") || s.includes('"') || s.includes("\n")) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(";")
        )
        .join("\n");

    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customName || invoiceNumber || "faktura"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    let qty = 0;
    let usdSum = 0;
    let eurSum = 0;
    let rsdOrientSum = 0;
    let rvelSum = 0;
    articles.forEach((a) => {
      const k = Number(a.kolicina) || 0;
      const u = Number(a.usd) || 0;
      const r = Number(a.rvel) || 0;
      qty += k;
      usdSum += k * u;
      eurSum += k * u * rates.usdEur;
      rsdOrientSum += k * u * koeficijent;
      rvelSum += k * r;
    });
    return { qty, usdSum, eurSum, rsdOrientSum, rvelSum };
  }, [articles, koeficijent, rates.usdEur]);

  function setRow(id: string, patch: Partial<InvoiceArticle>) {
    setArticles((arr) =>
      arr.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }

  function setStatus(id: string, s: SaveStatus) {
    setRowStatus((prev) => {
      const next = new Map(prev);
      next.set(id, s);
      return next;
    });
  }

  function scheduleRowSave(id: string) {
    const existing = rowDebounce.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => saveRow(id), 700);
    rowDebounce.current.set(id, t);
  }

  async function saveRow(id: string) {
    const a = articles.find((x) => x.id === id);
    if (!a) return;
    // Snapshot pre snimanja — za undo
    if (undoStack.current[undoStack.current.length - 1] !== articles) {
      undoStack.current.push(JSON.parse(JSON.stringify(articles)));
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
    }
    setStatus(id, "saving");
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_invoice_article", {
        p_id: a.id,
        p_invoice_id: invoice.id,
        p_position: a.position,
        p_model: a.model,
        p_tip: a.tip,
        p_boja: a.boja,
        p_kolicina: Number(a.kolicina) || 0,
        p_usd: Number(a.usd) || 0,
        p_rvel: Number(a.rvel) || 0,
      });
      if (error) throw new Error(error.message);
      setStatus(id, "saved");
      setTimeout(() => {
        setRowStatus((prev) => {
          const next = new Map(prev);
          if (next.get(id) === "saved") next.set(id, "idle");
          return next;
        });
      }, 1200);
    } catch (e: unknown) {
      setStatus(id, "error");
      setGlobalErr(e instanceof Error ? e.message : "Snimanje neuspešno.");
    }
  }

  function scheduleHeaderSave() {
    if (headerDebounce.current) clearTimeout(headerDebounce.current);
    headerDebounce.current = setTimeout(() => saveHeader(), 700);
  }

  async function saveHeader() {
    setHeaderStatus("saving");
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("update_invoice", {
        p_id: invoice.id,
        p_custom_name: customName || null,
        p_supplier_name: supplierName || null,
        p_invoice_number: invoiceNumber || null,
        p_invoice_date: invoiceDate || null,
        p_rates_json: rates as unknown as Record<string, unknown>,
      });
      if (error) throw new Error(error.message);
      setHeaderStatus("saved");
      setTimeout(() => setHeaderStatus("idle"), 1200);
    } catch (e: unknown) {
      setHeaderStatus("error");
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function addArticle() {
    setGlobalErr(null);
    try {
      const supabase = createSupabaseBrowser();
      const newPos = articles.length + 1;
      const { data, error } = await supabase
        .rpc("upsert_invoice_article", {
          p_id: null,
          p_invoice_id: invoice.id,
          p_position: newPos,
          p_model: "",
          p_tip: "",
          p_boja: "",
          p_kolicina: 0,
          p_usd: 0,
          p_rvel: 0,
        })
        .single<InvoiceArticle>();
      if (error) throw new Error(error.message);
      if (data) setArticles((arr) => [...arr, data]);
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function deleteArticle(id: string) {
    if (!confirm("Obrisati ovaj artikal?")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_invoice_article", { p_id: id });
      if (error) throw new Error(error.message);
      setArticles((arr) => arr.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function deleteInvoice() {
    if (!confirm("Obrisati celu fakturu sa svim artiklima?")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_invoice", { p_id: invoice.id });
      if (error) throw new Error(error.message);
      router.push("/master/fakture");
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  // Auto-save header on rates / metadata change
  useEffect(() => {
    scheduleHeaderSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, customName, supplierName, invoiceNumber, invoiceDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card-soft">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onBlur={() => setEditingName(false)}
                placeholder="Naziv fakture (npr. Quesste — april 2026)"
                className="w-full text-2xl md:text-3xl font-bold tracking-tight bg-transparent border-b-2 border-ink-900 focus:outline-none"
                autoFocus
              />
            ) : (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
                {customName || supplierName || invoiceNumber || "Faktura"}
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="p-1 rounded hover:bg-ink-100 text-ink-400"
                  title="Preimenuj"
                >
                  <Pencil size={16} />
                </button>
              </h1>
            )}
            <div className="text-xs text-ink-500 mt-1 tabular-nums">
              {invoice.api_cost > 0 && (
                <span>API trošak: ${Number(invoice.api_cost).toFixed(3)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HeaderStatus status={headerStatus} />
            <button
              type="button"
              onClick={deleteInvoice}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
            >
              Obriši
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Dobavljač
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="input mt-1.5"
              placeholder="DIZAYN BRANDS"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Broj fakture
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="input mt-1.5"
              placeholder="2026-04-001"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Datum
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="input mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* Formula bar */}
      <section className="card-soft bg-amber-50/40 border-amber-100">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-amber-700" />
          <h2 className="text-sm font-bold text-ink-900">Kursevi i formula</h2>
        </div>
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={autoFetchRates}
            disabled={ratesBusy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 text-xs font-semibold text-amber-800 disabled:opacity-50"
            title="Učitaj zvanične kurseve sa Frankfurter API-ja (ECB)"
          >
            <RefreshCw size={12} className={ratesBusy ? "animate-spin" : ""} />
            {ratesBusy ? "Učitavam…" : "Auto kurs (ECB)"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <NumberField
            label="USD/EUR"
            value={rates.usdEur}
            step={0.001}
            onChange={(v) => setRates((r) => ({ ...r, usdEur: v }))}
          />
          <NumberField
            label="EUR/RSD"
            value={rates.eurRsd}
            step={0.01}
            onChange={(v) => setRates((r) => ({ ...r, eurRsd: v }))}
          />
          <NumberField
            label="Popust %"
            value={rates.popust}
            step={0.5}
            onChange={(v) => setRates((r) => ({ ...r, popust: v }))}
          />
          <NumberField
            label="Markup %"
            value={rates.markup}
            step={1}
            onChange={(v) => setRates((r) => ({ ...r, markup: v }))}
          />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-ink-500">
              Koeficijent
            </div>
            <div className="mt-1.5 text-base font-bold text-amber-900 tabular-nums h-9 flex items-center">
              {koeficijent.toFixed(3)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-amber-800 mt-2">
          Koeficijent = (1 − popust/100) × USD/EUR × EUR/RSD × (1 + markup/100).
          USD × koeficijent = orijentaciona RSD vrednost.
        </p>
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

      {/* Articles table */}
      <section className="card-soft">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-ink-900">Artikli</h2>
            <p className="text-xs text-ink-500">
              {articles.length} stavki · količina{" "}
              <b>{totals.qty.toFixed(0)}</b> · USD <b>${totals.usdSum.toFixed(2)}</b>{" "}
              · EUR <b>€{totals.eurSum.toFixed(2)}</b> · MP RSD{" "}
              <b>{formatRSD(totals.rsdOrientSum)}</b>
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap no-print">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.current.length === 0}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-xs font-semibold disabled:opacity-40"
              title="Vrati (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.current.length === 0}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-xs font-semibold disabled:opacity-40"
              title="Ponovi (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={articles.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold disabled:opacity-50"
              title="Štampaj"
            >
              <Printer size={14} /> Štampaj
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={articles.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              title="Preuzmi tabelu kao CSV (otvara se u Excel-u)"
            >
              <Download size={14} /> Excel/CSV
            </button>
            <button
              type="button"
              onClick={addArticle}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ink-900 text-white text-sm font-semibold"
            >
              <Plus size={14} /> Dodaj red
            </button>
          </div>
        </div>

        <div className="mb-3 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            placeholder="Filtriraj po model/tip/boja…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        <div
          className="overflow-x-auto -mx-2"
          onFocus={(e) => {
            const target = e.target as HTMLElement;
            const td = target.closest("td[data-cell]") as HTMLElement | null;
            if (td) {
              const col = td.dataset.cellCol ?? "";
              const row = Number(td.dataset.cellRow ?? "0");
              if (col && row) setActiveCell({ row, col });
            }
          }}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 text-left bg-ink-50">
                <th className="px-2 py-2 w-8">#</th>
                <SortHeader col="model" sortBy={sortBy} toggle={toggleSort}>
                  Model
                </SortHeader>
                <SortHeader col="tip" sortBy={sortBy} toggle={toggleSort} className="w-20">
                  Tip
                </SortHeader>
                <SortHeader col="boja" sortBy={sortBy} toggle={toggleSort} className="w-24">
                  Boja
                </SortHeader>
                <SortHeader col="kolicina" sortBy={sortBy} toggle={toggleSort} className="w-16 text-right">
                  Kol.
                </SortHeader>
                <SortHeader col="usd" sortBy={sortBy} toggle={toggleSort} className="w-20 text-right">
                  USD
                </SortHeader>
                <th className="px-2 py-2 w-20 text-right bg-emerald-50">EUR</th>
                <th className="px-2 py-2 w-24 text-right bg-amber-50">RSD orij.</th>
                <SortHeader col="rvel" sortBy={sortBy} toggle={toggleSort} className="w-24 text-right">
                  RVEL
                </SortHeader>
                <SortHeader col="total" sortBy={sortBy} toggle={toggleSort} className="w-24 text-right bg-sky-50">
                  Ukupno USD
                </SortHeader>
                <th className="px-2 py-2 w-8"></th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-8 text-center text-ink-400 italic"
                  >
                    {articles.length === 0
                      ? 'Nema artikala. Klikni "Dodaj red".'
                      : "Filter ne pokazuje nijedan artikal."}
                  </td>
                </tr>
              ) : (
                filteredArticles.map((a, i) => {
                  const status = rowStatus.get(a.id) ?? "idle";
                  const k = Number(a.kolicina) || 0;
                  const u = Number(a.usd) || 0;
                  const eurUnit = u * rates.usdEur;
                  const rsdUnit = u * koeficijent;
                  const totalUsd = k * u;
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-ink-100 hover:bg-ink-50/40"
                    >
                      <td className="px-2 py-1.5 text-ink-500 tabular-nums text-xs">
                        {i + 1}
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="B" data-cell-row={i + 2}>
                        <Cell
                          value={a.model ?? ""}
                          onChange={(v) => {
                            setRow(a.id, { model: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="C" data-cell-row={i + 2}>
                        <Cell
                          value={a.tip ?? ""}
                          onChange={(v) => {
                            setRow(a.id, { tip: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="D" data-cell-row={i + 2}>
                        <Cell
                          value={a.boja ?? ""}
                          onChange={(v) => {
                            setRow(a.id, { boja: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="E" data-cell-row={i + 2}>
                        <NumCell
                          value={a.kolicina}
                          onChange={(v) => {
                            setRow(a.id, { kolicina: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="F" data-cell-row={i + 2}>
                        <NumCell
                          value={a.usd}
                          onChange={(v) => {
                            setRow(a.id, { usd: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-emerald-800 bg-emerald-50/40">
                        {u > 0 ? `€${eurUnit.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-amber-800 bg-amber-50/40 font-semibold">
                        {u > 0 ? Math.round(rsdUnit).toLocaleString("sr-RS") : "—"}
                      </td>
                      <td className="px-1 py-1" data-cell data-cell-col="I" data-cell-row={i + 2}>
                        <NumCell
                          value={a.rvel}
                          onChange={(v) => {
                            setRow(a.id, { rvel: v });
                            scheduleRowSave(a.id);
                          }}
                          onBlur={() => saveRow(a.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs text-sky-800 bg-sky-50/40 font-semibold">
                        {totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <RowStatus status={status} />
                      </td>
                      <td className="px-1 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => deleteArticle(a.id)}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                          title="Obriši"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
              {articles.length > 0 && (
                <tr className="border-t-2 border-ink-300 bg-ink-100/60 font-bold">
                  <td colSpan={4} className="px-2 py-2 text-xs uppercase tracking-wider text-ink-700">
                    Ukupno
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-900">
                    {totals.qty.toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-900">
                    ${totals.usdSum.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-800 bg-emerald-50">
                    €{totals.eurSum.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-800 bg-amber-50">
                    {Math.round(totals.rsdOrientSum).toLocaleString("sr-RS")}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-ink-900">
                    {Math.round(totals.rvelSum).toLocaleString("sr-RS")}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-sky-800 bg-sky-50">
                    ${totals.usdSum.toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs text-ink-500 space-y-1 no-print">
        <p>
          Sve izmene se snimaju automatski. Inline kalkulator: kuca{" "}
          <code className="bg-ink-100 px-1 rounded">44*0.95</code> u Količinu/USD/RVEL polje,
          na blur izračunava i čuva. <b>Ctrl+Z</b> vrati, <b>Ctrl+Y</b> ponovi (do 50 koraka).
        </p>
        <p>
          <b>EUR</b> = USD × USD/EUR kurs (auto). <b>RSD orij.</b> = USD ×
          koeficijent (orijentaciona maloprodajna cena, auto).{" "}
          <b>RVEL</b> = veleprodajna cena u RSD koju upisuješ ručno.{" "}
          <b>Ukupno USD</b> = Količina × USD.
        </p>
      </div>

      {/* Status bar — sticky dole */}
      <div className="sticky bottom-0 -mx-5 md:-mx-8 mt-6 px-5 md:px-8 py-2 bg-ink-900 text-white text-xs font-mono flex items-center justify-between border-t border-ink-700 no-print">
        <div className="flex items-center gap-4">
          <span className="font-bold">
            {activeCell ? `${activeCell.col}${activeCell.row}` : "—"}
          </span>
          <span className="opacity-70">
            {filteredArticles.length} / {articles.length} red.
          </span>
        </div>
        <div className="flex items-center gap-3 opacity-90">
          <span>qty: <b>{totals.qty.toFixed(0)}</b></span>
          <span>USD: <b>${totals.usdSum.toFixed(2)}</b></span>
          <span>EUR: <b>€{totals.eurSum.toFixed(2)}</b></span>
          <span className="hidden sm:inline">
            RSD orij: <b>{Math.round(totals.rsdOrientSum).toLocaleString("sr-RS")}</b>
          </span>
        </div>
      </div>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          input,
          select,
          textarea {
            border: none !important;
            background: transparent !important;
          }
          .card-soft {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          table {
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

function SortHeader({
  col,
  sortBy,
  toggle,
  className,
  children,
}: {
  col: keyof InvoiceArticle | "total";
  sortBy: { col: keyof InvoiceArticle | "total"; dir: "asc" | "desc" } | null;
  toggle: (col: keyof InvoiceArticle | "total") => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = sortBy?.col === col;
  return (
    <th
      onClick={() => toggle(col)}
      className={`px-2 py-2 cursor-pointer hover:bg-ink-100 select-none ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          <span className="text-ink-700 text-[10px]">
            {sortBy.dir === "asc" ? "▲" : "▼"}
          </span>
        ) : (
          <ArrowUpDown size={9} className="opacity-30" />
        )}
      </span>
    </th>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-bold text-ink-500">
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="input mt-1.5 text-right tabular-nums h-9"
      />
    </div>
  );
}

function Cell({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full h-8 px-2 rounded text-sm bg-transparent focus:bg-sky-50 focus:outline-none focus:ring-1 focus:ring-sky-300"
    />
  );
}

function NumCell({
  value,
  onChange,
  onBlur,
}: {
  value: number;
  onChange: (v: number) => void;
  onBlur: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        // Inline kalkulator — proba da evaluira jednostavne izraze (samo + - * /)
        let final: number;
        const safe = draft.replace(",", ".").trim();
        if (safe === "") {
          final = 0;
        } else if (/^[\d.+\-*/() ]+$/.test(safe)) {
          try {
            // eslint-disable-next-line no-new-func
            final = Number(new Function(`return (${safe});`)());
            if (!Number.isFinite(final) || final < 0) final = Number(value);
          } catch {
            final = Number(value);
          }
        } else {
          final = Number(value);
        }
        setDraft(String(final));
        onChange(final);
        onBlur();
      }}
      className="w-full h-8 px-2 rounded text-sm text-right tabular-nums bg-transparent focus:bg-sky-50 focus:outline-none focus:ring-1 focus:ring-sky-300"
    />
  );
}

function HeaderStatus({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return <Loader2 size={14} className="text-ink-500 animate-spin" />;
  if (status === "saved")
    return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (status === "error")
    return <AlertTriangle size={14} className="text-rose-600" />;
  return null;
}

function RowStatus({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return <Loader2 size={12} className="text-ink-400 animate-spin inline" />;
  if (status === "saved")
    return <CheckCircle2 size={12} className="text-emerald-600 inline" />;
  if (status === "error")
    return <AlertTriangle size={12} className="text-rose-600 inline" />;
  return null;
}
