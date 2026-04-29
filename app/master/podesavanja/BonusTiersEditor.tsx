"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CalendarRange,
  X,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { STORE_LABELS_SHORT } from "@/lib/format";

interface CategoryTier {
  store_id: string;
  category: number;
  bonus_98_100: number;
  bonus_87_97: number;
  bonus_77_86: number;
  bonus_70_76: number;
  bonus_65_69: number;
}

interface MonthCategory {
  store_id: string;
  year: number;
  month: number;
  category: number;
}

const STORES = ["D1", "D2", "D4", "D5"];

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

// Redosled prikaza: 5 (najjača) na vrhu pa nadole do 1 — kao u screenshot-u
const CATEGORY_ORDER = [5, 4, 3, 2, 1];

type SaveStatus = "idle" | "saving" | "saved" | "error";
interface TierFormState {
  bonus_98_100: string;
  bonus_87_97: string;
  bonus_77_86: string;
  bonus_70_76: string;
  bonus_65_69: string;
  status: SaveStatus;
  error: string | null;
}

const EMPTY_TIER: TierFormState = {
  bonus_98_100: "",
  bonus_87_97: "",
  bonus_77_86: "",
  bonus_70_76: "",
  bonus_65_69: "",
  status: "idle",
  error: null,
};

const tierFields: Array<keyof Omit<TierFormState, "status" | "error">> = [
  "bonus_98_100",
  "bonus_87_97",
  "bonus_77_86",
  "bonus_70_76",
  "bonus_65_69",
];

export default function BonusTiersEditor() {
  const [activeStore, setActiveStore] = useState<string>("D1");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [tiers, setTiers] = useState<Map<number, TierFormState>>(new Map());
  const [monthCats, setMonthCats] = useState<Map<number, number | null>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showMonthEditor, setShowMonthEditor] = useState(false);
  const [monthSaveFlash, setMonthSaveFlash] = useState<Set<number>>(new Set());
  const debounceRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur - 1, cur, cur + 1, cur + 2];
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const [{ data: tiersData, error: tiersErr }, { data: monthData, error: monthErr }] =
          await Promise.all([
            supabase.rpc("list_category_tiers", { p_store_id: activeStore }),
            supabase.rpc("list_month_categories", {
              p_store_id: activeStore,
              p_year: year,
            }),
          ]);
        if (tiersErr) throw new Error(tiersErr.message);
        if (monthErr) throw new Error(monthErr.message);
        if (cancelled) return;

        const t = new Map<number, TierFormState>();
        for (let c = 1; c <= 5; c++) t.set(c, { ...EMPTY_TIER });
        ((tiersData ?? []) as CategoryTier[]).forEach((row) => {
          t.set(row.category, {
            bonus_98_100: row.bonus_98_100 ? String(row.bonus_98_100) : "",
            bonus_87_97: row.bonus_87_97 ? String(row.bonus_87_97) : "",
            bonus_77_86: row.bonus_77_86 ? String(row.bonus_77_86) : "",
            bonus_70_76: row.bonus_70_76 ? String(row.bonus_70_76) : "",
            bonus_65_69: row.bonus_65_69 ? String(row.bonus_65_69) : "",
            status: "idle",
            error: null,
          });
        });
        setTiers(t);

        const m = new Map<number, number | null>();
        for (let i = 1; i <= 12; i++) m.set(i, null);
        ((monthData ?? []) as MonthCategory[]).forEach((row) => {
          m.set(row.month, row.category);
        });
        setMonthCats(m);
      } catch (e: unknown) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Greška pri učitavanju.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeStore, year]);

  function updateTier(category: number, patch: Partial<TierFormState>) {
    setTiers((prev) => {
      const next = new Map(prev);
      const cur = next.get(category) ?? { ...EMPTY_TIER };
      next.set(category, { ...cur, ...patch });
      return next;
    });
  }

  function scheduleSaveTier(category: number) {
    const existing = debounceRef.current.get(category);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => saveTier(category), 800);
    debounceRef.current.set(category, t);
  }

  async function saveTier(category: number) {
    const row = tiers.get(category);
    if (!row) return;

    const parse = (s: string) => {
      const cleaned = s.trim().replace(",", ".");
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const v98 = parse(row.bonus_98_100);
    const v87 = parse(row.bonus_87_97);
    const v77 = parse(row.bonus_77_86);
    const v70 = parse(row.bonus_70_76);
    const v65 = parse(row.bonus_65_69);

    if (v98 === null || v87 === null || v77 === null || v70 === null || v65 === null) {
      updateTier(category, {
        status: "error",
        error: "Iznosi moraju biti broj (ne negativan).",
      });
      return;
    }

    updateTier(category, { status: "saving", error: null });

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_category_bonus_tier", {
        p_store_id: activeStore,
        p_category: category,
        p_bonus_98_100: v98,
        p_bonus_87_97: v87,
        p_bonus_77_86: v77,
        p_bonus_70_76: v70,
        p_bonus_65_69: v65,
      });
      if (error) throw new Error(error.message);
      updateTier(category, { status: "saved", error: null });
      setTimeout(() => updateTier(category, { status: "idle" }), 1500);
    } catch (e: unknown) {
      updateTier(category, {
        status: "error",
        error: e instanceof Error ? `Greška: ${e.message}` : "Snimanje neuspešno.",
      });
    }
  }

  async function setMonthCategory(month: number, category: number | null) {
    setMonthCats((prev) => {
      const next = new Map(prev);
      next.set(month, category);
      return next;
    });
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_month_category", {
        p_store_id: activeStore,
        p_year: year,
        p_month: month,
        p_category: category,
      });
      if (error) throw new Error(error.message);
      setMonthSaveFlash((prev) => new Set(prev).add(month));
      setTimeout(() => {
        setMonthSaveFlash((prev) => {
          const n = new Set(prev);
          n.delete(month);
          return n;
        });
      }, 1500);
    } catch (e) {
      console.error("month category save failed", e);
      setLoadError(e instanceof Error ? `Greška: ${e.message}` : "Snimanje neuspešno.");
    }
  }

  // Mapa: kategorija → niz meseci dodeljenih toj kategoriji
  const monthsByCategory = useMemo(() => {
    const m = new Map<number, number[]>();
    for (let c = 1; c <= 5; c++) m.set(c, []);
    Array.from(monthCats.entries()).forEach(([month, cat]) => {
      if (cat != null) {
        const arr = m.get(cat) ?? [];
        arr.push(month);
        m.set(cat, arr);
      }
    });
    // Sortiraj mesece u svakoj kategoriji
    m.forEach((arr) => arr.sort((a, b) => a - b));
    return m;
  }, [monthCats]);

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-ink-500 leading-relaxed">
        Po radnji uneseš 5 templejta kategorija (1 = najjača, 5 = najslabija).
        Za svaki mesec biraš kojoj kategoriji pripada. Bonus po radnici =
        ukupan iznos templejta ÷ broj radnica te radnje.
      </p>

      {/* Store + year */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {STORES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStore(s)}
              className={
                activeStore === s
                  ? "px-3 py-2 rounded-lg bg-ink-900 text-white text-sm font-bold"
                  : "px-3 py-2 rounded-lg bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
              }
            >
              <span className="font-bold">{s}</span>{" "}
              <span className="opacity-70">
                {STORE_LABELS_SHORT[s]?.replace(`${s} `, "") ?? ""}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex items-center gap-2 text-sm">
          <label className="text-xs font-semibold text-ink-500">Godina:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-2 rounded-lg border border-ink-200 bg-white text-sm tabular-nums"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Glavna tabela: red = kategorija (5→1), MESEC kolona pokazuje koje mesece je u toj kategoriji */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 text-left bg-ink-50">
              <th className="px-3 py-2.5 w-32 border border-ink-200">MESEC</th>
              <th className="px-3 py-2.5 w-16 text-center border border-ink-200">KAT</th>
              <th className="px-3 py-2.5 text-right border border-ink-200">100%-98%</th>
              <th className="px-3 py-2.5 text-right border border-ink-200">97-87%</th>
              <th className="px-3 py-2.5 text-right border border-ink-200">86%-77%</th>
              <th className="px-3 py-2.5 text-right border border-ink-200">76%-70%</th>
              <th className="px-3 py-2.5 text-right border border-ink-200">69%-65%</th>
              <th className="px-3 py-2.5 w-12 text-center border border-ink-200"></th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((cat) => {
              const months = monthsByCategory.get(cat) ?? [];
              const row = tiers.get(cat) ?? EMPTY_TIER;
              return (
                <tr key={cat} className="bg-white">
                  <td className="px-3 py-2.5 border border-ink-200 text-sm font-semibold text-ink-900 tabular-nums">
                    {months.length > 0 ? months.join(", ") : <span className="text-ink-300 italic font-normal">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border border-ink-200 text-center text-base font-bold text-ink-900 tabular-nums">
                    {cat}
                  </td>
                  {tierFields.map((field) => (
                    <td key={field} className="px-1 py-1 border border-ink-200">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        className="w-full h-9 px-2 rounded text-sm text-right tabular-nums focus:outline-none focus:bg-sky-50"
                        value={row[field]}
                        onChange={(e) => {
                          updateTier(cat, { [field]: e.target.value, status: "idle" });
                          scheduleSaveTier(cat);
                        }}
                        onBlur={() => saveTier(cat)}
                        disabled={loading}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 border border-ink-200 text-center">
                    {row.status === "saving" && (
                      <Loader2 size={14} className="text-ink-500 animate-spin inline" />
                    )}
                    {row.status === "saved" && (
                      <CheckCircle2 size={14} className="text-emerald-600 inline" />
                    )}
                    {row.status === "error" && (
                      <AlertTriangle
                        size={14}
                        className="text-rose-600 inline"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dugme za izmenu kategorija po mesecima */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowMonthEditor(true)}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-ink-900 hover:bg-ink-800 text-white text-sm font-semibold"
        >
          <CalendarRange size={16} /> Izmeni kategorije po mesecima
        </button>
        <p className="text-xs text-ink-500 mt-2">
          Za godinu <b>{year}</b>, radnju <b>{activeStore}</b>. Promene se
          snimaju automatski.
        </p>
      </div>

      {/* Greske u redovima */}
      {Array.from(tiers.values()).find((t) => t.error) && (
        <div className="text-xs text-rose-700 space-y-1">
          {Array.from(tiers.entries())
            .filter(([, t]) => t.error)
            .map(([cat, t]) => (
              <div key={cat}>
                Kategorija {cat}: {t.error}
              </div>
            ))}
        </div>
      )}

      {/* Modal: meseci po kategorijama */}
      {showMonthEditor && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMonthEditor(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-ink-900">
                  Kategorije po mesecima
                </h3>
                <p className="text-xs text-ink-500">
                  {activeStore} · {year}. godina
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthEditor(false)}
                className="p-1.5 rounded hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-1.5">
              {Array.from({ length: 12 }).map((_, i) => {
                const month = i + 1;
                const cat = monthCats.get(month);
                const flash = monthSaveFlash.has(month);
                return (
                  <div
                    key={month}
                    className="flex items-center gap-3 bg-ink-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-ink-900 min-w-[100px]">
                      {month}. {MONTH_NAMES[i]}
                    </span>
                    <select
                      value={cat ?? ""}
                      onChange={(e) =>
                        setMonthCategory(
                          month,
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      className={clsx(
                        "flex-1 h-9 px-2 rounded border bg-white text-sm transition",
                        flash ? "border-emerald-400 ring-2 ring-emerald-100" : "border-ink-200"
                      )}
                    >
                      <option value="">— Bez kategorije —</option>
                      <option value="1">Kategorija 1 (najjača)</option>
                      <option value="2">Kategorija 2</option>
                      <option value="3">Kategorija 3</option>
                      <option value="4">Kategorija 4</option>
                      <option value="5">Kategorija 5 (najslabija)</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex justify-end bg-ink-50/40 sticky bottom-0">
              <button
                type="button"
                onClick={() => setShowMonthEditor(false)}
                className="btn-primary"
              >
                Gotovo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
