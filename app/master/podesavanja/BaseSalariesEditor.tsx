"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { STORE_LABELS_SHORT } from "@/lib/format";

interface Worker {
  id: string;
  initials: string;
  store_id: string;
  active: boolean;
  base_salary: number | null;
}

const STORES = ["D1", "D2", "D4", "D5"];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function BaseSalariesEditor() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [statuses, setStatuses] = useState<Map<string, SaveStatus>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStore, setActiveStore] = useState<string>("D1");
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowser();
        const { data, error } = await supabase
          .from("workers")
          .select("id, initials, store_id, active, base_salary")
          .eq("active", true)
          .order("store_id")
          .order("initials");
        if (error) throw new Error(error.message);
        if (cancelled) return;
        const list = (data ?? []) as Worker[];
        setWorkers(list);

        const ds = new Map<string, string>();
        list.forEach((w) =>
          ds.set(w.id, w.base_salary != null ? String(w.base_salary) : "")
        );
        setDrafts(ds);
      } catch (e: unknown) {
        if (!cancelled)
          setLoadErr(e instanceof Error ? e.message : "Greška pri učitavanju.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const storeWorkers = useMemo(
    () => workers.filter((w) => w.store_id === activeStore),
    [workers, activeStore]
  );

  function setDraft(id: string, val: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(id, val);
      return next;
    });
  }

  function setStatus(id: string, s: SaveStatus) {
    setStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, s);
      return next;
    });
  }

  function setError(id: string, msg: string | null) {
    setErrors((prev) => {
      const next = new Map(prev);
      if (msg === null) next.delete(id);
      else next.set(id, msg);
      return next;
    });
  }

  function scheduleSave(id: string) {
    const existing = debounceRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => save(id), 800);
    debounceRef.current.set(id, t);
  }

  async function save(id: string) {
    const val = (drafts.get(id) ?? "").trim().replace(",", ".");
    let amount: number | null;
    if (val === "") {
      amount = null;
    } else {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        setStatus(id, "error");
        setError(id, "Iznos mora biti broj (ili prazno).");
        return;
      }
      amount = n;
    }

    setStatus(id, "saving");
    setError(id, null);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("update_worker_base_salary", {
        p_worker_id: id,
        p_amount: amount,
      });
      if (error) throw new Error(error.message);

      setWorkers((ws) =>
        ws.map((x) => (x.id === id ? { ...x, base_salary: amount } : x))
      );
      setStatus(id, "saved");
      setTimeout(() => {
        setStatuses((prev) => {
          const next = new Map(prev);
          if (next.get(id) === "saved") next.set(id, "idle");
          return next;
        });
      }, 1500);
    } catch (e: unknown) {
      setStatus(id, "error");
      setError(id, e instanceof Error ? e.message : "Snimanje neuspešno.");
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-ink-500 leading-relaxed">
        Osnovica plate po radnici. Kuca se i automatski snima kad prestaneš da
        kucaš. Sistem je predlaže kao default kad unosiš mesečnu platu u HR →
        Plate. Bonus se dodaje preko bonus tier sistema.
      </p>

      {/* Store tabs */}
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

      {loadErr && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-900 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{loadErr}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-400 py-4">Učitavam radnice…</div>
      ) : (
        <div className="rounded-xl bg-white border border-ink-100 p-4">
          {storeWorkers.length === 0 ? (
            <div className="text-xs text-ink-400 italic py-2 text-center">
              Nema aktivnih radnica u radnji {activeStore}.
            </div>
          ) : (
            <ul className="space-y-2">
              {storeWorkers.map((w) => {
                const draft = drafts.get(w.id) ?? "";
                const status = statuses.get(w.id) ?? "idle";
                const err = errors.get(w.id);

                return (
                  <li
                    key={w.id}
                    className="flex items-center gap-2 bg-ink-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-mono font-bold text-sm text-ink-900 shrink-0 min-w-[50px]">
                      {w.initials}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="iznos u RSD"
                      value={draft}
                      onChange={(e) => {
                        setDraft(w.id, e.target.value);
                        setStatus(w.id, "idle");
                        setError(w.id, null);
                        scheduleSave(w.id);
                      }}
                      onBlur={() => save(w.id)}
                      className="flex-1 h-9 px-2.5 rounded bg-white border border-ink-200 text-sm text-right tabular-nums focus:border-ink-900 focus:ring-1 focus:ring-ink-900"
                    />
                    <div className="w-6 flex items-center justify-center">
                      {status === "saving" && (
                        <Loader2
                          size={14}
                          className="text-ink-500 animate-spin"
                        />
                      )}
                      {status === "saved" && (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      )}
                      {status === "error" && (
                        <AlertTriangle size={14} className="text-rose-600" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {storeWorkers.some((w) => errors.has(w.id)) && (
            <div className="mt-3 text-xs text-rose-700 space-y-1">
              {Array.from(errors.entries())
                .filter(([id]) => storeWorkers.some((w) => w.id === id))
                .map(([id, msg]) => {
                  const w = storeWorkers.find((x) => x.id === id);
                  return (
                    <div key={id}>
                      <b>{w?.initials}</b>: {msg}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
