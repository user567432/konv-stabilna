"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  Search,
  Calendar,
  Package,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase";

interface HistoryRow {
  article_id: string;
  sifra: string;
  naziv: string;
  proizvodjac: string | null;
  boja: string | null;
  velicina: string | null;
  barkod: string | null;
  total_simple: number;
  total_doc: number;
  total_sum: number;
  last_date: string | null;
}

export default function IstorijaClient() {
  const [list, setList] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data, error } = await supabase.rpc("get_feler_history");
        if (error) throw new Error(error.message);
        setList((data ?? []) as HistoryRow[]);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Greška.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (r) =>
        r.naziv.toLowerCase().includes(q) ||
        (r.sifra ?? "").toLowerCase().includes(q) ||
        (r.proizvodjac ?? "").toLowerCase().includes(q) ||
        (r.barkod ?? "").toLowerCase().includes(q)
    );
  }, [list, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, HistoryRow[]>();
    filtered.forEach((r) => {
      const key = r.proizvodjac ?? "Bez proizvođača";
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    });
    return Array.from(m.entries())
      .map(([proizvodjac, items]) => {
        const total = items.reduce((s, r) => s + r.total_sum, 0);
        return { proizvodjac, items, total };
      })
      .sort((a, b) => b.total - a.total); // najgori dobavljači prvi
  }, [filtered]);

  const grandTotal = useMemo(
    () => filtered.reduce((s, r) => s + r.total_sum, 0),
    [filtered]
  );

  function toggleGroup(p: string) {
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  }

  function expandAll() {
    setOpenGroups(new Set(grouped.map((g) => g.proizvodjac)));
  }

  function collapseAll() {
    setOpenGroups(new Set());
  }

  async function deleteArticleHistory(
    article_id: string,
    naziv: string,
    includeDocs: boolean
  ) {
    if (
      !confirm(
        `Obrisati istoriju felera za "${naziv}"?` +
          (includeDocs ? " (uključi i unose iz dokumenata)" : "") +
          " Ova akcija se ne može vratiti."
      )
    )
      return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("delete_history_for_article", {
        p_article_id: article_id,
        p_include_docs: includeDocs,
      });
      if (error) throw new Error(error.message);
      setList((arr) => arr.filter((r) => r.article_id !== article_id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    }
  }

  async function resetAllStats() {
    if (
      !confirm(
        "TRAJNO obrisati svu istoriju felera (i pojedinačne i iz dokumenata)? " +
          "Ova akcija se NE MOŽE vratiti."
      )
    )
      return;
    if (!confirm("Sigurno? Drugi put pita za potvrdu.")) return;
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("reset_all_feler_stats");
      if (error) throw new Error(error.message);
      setList([]);
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
            placeholder="Pretraži po artiklu, šifri, proizvođaču, barkodu…"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-ink-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ink-900"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={expandAll}
          className="h-11 px-3 rounded-xl bg-white border border-ink-200 hover:bg-ink-50 text-xs font-semibold text-ink-700"
        >
          Otvori sve
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="h-11 px-3 rounded-xl bg-white border border-ink-200 hover:bg-ink-50 text-xs font-semibold text-ink-700"
        >
          Zatvori sve
        </button>
        {list.length > 0 && (
          <button
            type="button"
            onClick={resetAllStats}
            title="TRAJNO obriši svu istoriju felera"
            className="h-11 px-3 rounded-xl bg-white border border-rose-300 hover:bg-rose-50 text-xs font-semibold text-rose-700 inline-flex items-center gap-1.5"
          >
            <Trash2 size={12} /> Resetuj statistike
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
      ) : grouped.length === 0 ? (
        <div className="card-soft text-center py-16">
          <Package className="mx-auto mb-3 text-ink-300" size={40} />
          <p className="text-ink-500">
            {query.trim()
              ? "Nema rezultata za tu pretragu."
              : "Još uvek nema istorije felera."}
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="card-soft bg-amber-50/40 border-amber-100">
            <div className="grid grid-cols-3 gap-4 text-center">
              <Stat label="Proizvođača" value={grouped.length} />
              <Stat label="Različitih artikala" value={filtered.length} />
              <Stat label="Ukupno felera" value={grandTotal} />
            </div>
          </div>

          {/* Grouped list */}
          <div className="space-y-2">
            {grouped.map((g) => {
              const isOpen = openGroups.has(g.proizvodjac);
              return (
                <section
                  key={g.proizvodjac}
                  className="card-soft p-0 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.proizvodjac)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-ink-50 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isOpen ? (
                        <ChevronDown
                          size={16}
                          className="text-ink-400 shrink-0"
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="text-ink-400 shrink-0"
                        />
                      )}
                      <span className="font-bold text-ink-900 text-left truncate">
                        {g.proizvodjac}
                      </span>
                      <span className="text-xs text-ink-500">
                        · {g.items.length} artikala
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 text-xs font-bold tabular-nums shrink-0">
                      {g.total} felera
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-100 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-ink-50/50">
                          <tr className="text-left">
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500">
                              Šifra
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500">
                              Artikal
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 w-20">
                              Boja
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 w-16">
                              Vel.
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 text-right w-16">
                              Pojed.
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 text-right w-16">
                              Dok.
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 text-right w-16">
                              ∑
                            </th>
                            <th className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-ink-500 w-32">
                              Poslednji
                            </th>
                            <th className="px-3 py-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {g.items
                            .sort((a, b) => b.total_sum - a.total_sum)
                            .map((row) => (
                              <tr key={row.article_id} className="hover:bg-ink-50/30">
                                <td className="px-3 py-2 font-mono text-xs text-ink-700">
                                  {row.sifra}
                                </td>
                                <td className="px-3 py-2 text-ink-900 font-medium">
                                  {row.naziv}
                                  {row.barkod && (
                                    <div className="text-[10px] text-ink-400 font-mono">
                                      {row.barkod}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-xs text-ink-600">
                                  {row.boja ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-xs text-ink-600">
                                  {row.velicina ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-700">
                                  {row.total_simple || "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-700">
                                  {row.total_doc || "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-rose-800">
                                  {row.total_sum}
                                </td>
                                <td className="px-3 py-2 text-xs text-ink-500">
                                  {row.last_date ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar size={10} />
                                      {new Date(row.last_date).toLocaleDateString(
                                        "sr-RS"
                                      )}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteArticleHistory(
                                        row.article_id,
                                        row.naziv,
                                        true
                                      )
                                    }
                                    title="Obriši istoriju za ovaj artikal"
                                    className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Legend */}
          <p className="text-[11px] text-ink-500 leading-relaxed">
            <b>Pojed.</b> = pojedinačni feleri (iz radnji), <b>Dok.</b> =
            artikli koji su ušli u dokumente reklamacija, <b>∑</b> = ukupno (oba
            zbira).
          </p>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-amber-900">
        {label}
      </div>
      <div className="text-2xl font-bold text-ink-900 tabular-nums">{value}</div>
    </div>
  );
}
