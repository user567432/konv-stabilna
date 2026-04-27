import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { loadTeamRanking, MIN_SHIFTS_FOR_RANK } from "@/lib/worker-stats";
import { formatPct, STORE_LABELS_SHORT } from "@/lib/format";

interface Props {
  storeFilter?: string; // ako je zadato, prikazuje samo tu radnju
  days?: number;        // default 30
  compact?: boolean;    // za /unos panel, true = manja kartica
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function TeamRankingCard({
  storeFilter,
  days = 30,
  compact = false,
}: Props) {
  const start = daysAgo(days - 1);
  const end = new Date().toISOString().slice(0, 10);
  const data = await loadTeamRanking(start, end);
  const stores = storeFilter
    ? data.per_store.filter((s) => s.store_id === storeFilter)
    : data.per_store;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          {compact ? "Tim rang (30 dana)" : "Tim rang — top 3 po radnji"}
        </h3>
        <Link
          href={`/tim-rang?start=${start}&end=${end}`}
          className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
        >
          Vidi sve <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className={compact ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {stores.map((store) => {
          const top3 = store.ranked.slice(0, 3);
          return (
            <div key={store.store_id} className="rounded-xl bg-ink-50 p-3">
              <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                {STORE_LABELS_SHORT[store.store_id] ?? store.store_name}
              </div>
              {top3.length === 0 ? (
                <div className="text-xs text-ink-400 py-2">
                  Nedovoljno podataka (potrebno {MIN_SHIFTS_FOR_RANK}+ smena po
                  radnici)
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {top3.map((r, idx) => (
                    <li
                      key={r.worker_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={
                            idx === 0
                              ? "w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center"
                              : "w-5 h-5 rounded-full bg-ink-200 text-ink-700 text-xs font-bold flex items-center justify-center"
                          }
                        >
                          {idx + 1}
                        </span>
                        <span className="font-mono font-bold text-ink-900">
                          {r.initials}
                        </span>
                        <span className="text-ink-400 text-xs">
                          {r.shifts_count} sm.
                        </span>
                      </div>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        {formatPct(r.conversion)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
