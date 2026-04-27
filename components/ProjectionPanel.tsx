import type { ProjectionSummary } from "@/lib/projection";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatRSD } from "@/lib/format";

export default function ProjectionPanel({ projection }: { projection: ProjectionSummary }) {
  const { total, per_store, month_label, computed_at } = projection;

  return (
    <div className="card-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-ink-700" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
            Projekcija meseca · {month_label}
          </h3>
        </div>
        <span className="text-xs text-ink-400">
          dan {total.days_passed + 1} od {total.days_in_month}
        </span>
      </div>

      {/* Ukupno */}
      <div className="rounded-xl bg-ink-50 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Ukupno sve 4 radnje
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {formatRSD(total.mtd_revenue)}
            </div>
            {total.target !== null && (
              <div className="text-xs text-ink-500 tabular-nums">
                cilj meseca: {formatRSD(total.target)}
              </div>
            )}
          </div>
          {total.pct_of_target !== null && <PctBadge pct={total.pct_of_target} />}
        </div>

        {total.target !== null && (
          <>
            <div className="mt-3 h-2 bg-ink-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${pctColor(total.pct_of_target ?? 0, true)}`}
                style={{
                  width: `${Math.min(100, ((total.mtd_revenue / total.target) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-ink-500">Projekcija kraja</div>
                <div className="font-bold tabular-nums text-ink-900">
                  {formatRSD(total.projected_month)}
                </div>
              </div>
              <div>
                <div className="text-ink-500">Run rate</div>
                <div className="font-bold tabular-nums text-ink-900">
                  {formatRSD(total.run_rate_daily)}/dan
                </div>
              </div>
              <div>
                <div className="text-ink-500">Potreban tempo</div>
                <div className="font-bold tabular-nums text-ink-900">
                  {formatRSD(total.required_daily_pace ?? 0)}/dan
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Po radnji */}
      <div className="grid md:grid-cols-2 gap-3">
        {per_store.map((p) => (
          <StoreProjectionRow key={p.store_id} p={p} />
        ))}
      </div>

      <div className="mt-3 text-[10px] text-ink-400 text-right">
        Osveženo {new Date(computed_at).toLocaleTimeString("sr-RS")}
      </div>
    </div>
  );
}

function StoreProjectionRow({ p }: { p: ProjectionSummary["per_store"][number] }) {
  return (
    <div className="rounded-xl bg-white border border-ink-100 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded">
            {p.store_id}
          </span>
          <span className="text-sm font-semibold text-ink-900">
            {formatRSD(p.mtd_revenue)}
          </span>
        </div>
        {p.pct_of_target !== null && <PctBadge pct={p.pct_of_target} small />}
      </div>

      {p.target !== null && (
        <>
          <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${pctColor(p.pct_of_target ?? 0, false)}`}
              style={{
                width: `${Math.min(100, (p.mtd_revenue / p.target) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 text-[11px] text-ink-500 tabular-nums">
            Projekcija: <b className="text-ink-700">{formatRSD(p.projected_month)}</b> ·
            cilj {formatRSD(p.target)}
          </div>
          {p.required_daily_pace !== null && p.required_daily_pace > 0 && (
            <div className="text-[11px] text-ink-500 tabular-nums">
              Potrebno {formatRSD(p.required_daily_pace)}/dan u narednih {p.days_remaining} dana
            </div>
          )}
        </>
      )}
      {p.target === null && (
        <div className="mt-2 text-[11px] text-ink-400 italic">
          Mesečni cilj nije postavljen (Podešavanja → ciljevi)
        </div>
      )}
    </div>
  );
}

function PctBadge({ pct, small }: { pct: number; small?: boolean }) {
  const cls =
    pct >= 100
      ? "bg-emerald-100 text-emerald-800"
      : pct >= 90
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  const Icon = pct >= 100 ? TrendingUp : pct >= 90 ? Minus : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 ${
        small ? "py-0.5 text-[10px]" : "py-1 text-xs"
      } font-bold tabular-nums ${cls}`}
    >
      <Icon size={small ? 10 : 12} />
      {Math.round(pct)}%
    </span>
  );
}

function pctColor(pct: number, large: boolean): string {
  const base = large ? "bg-" : "bg-";
  if (pct >= 100) return `${base}emerald-500`;
  if (pct >= 90) return `${base}amber-500`;
  return `${base}rose-500`;
}
