"use client";

import { useEffect, useState } from "react";
import { formatRSD, formatDateSr, formatPct } from "@/lib/format";
import { Target, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Progress {
  week: {
    start: string;
    end: string;
    goal_rsd: number;
    revenue_rsd: number;
    progress_pct: number;
    remaining_rsd: number;
  };
  month: {
    start: string;
    end: string;
    source_month: string;
    goal_rsd: number;
    revenue_rsd: number;
    progress_pct: number;
    remaining_rsd: number;
  };
  daily: { date: string; revenue: number }[];
}

export default function WorkerProgress({ storeId }: { storeId: string }) {
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetch(`/api/worker-progress?store_id=${storeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [storeId]);

  if (!storeId) return null;
  if (loading) {
    return (
      <div className="card text-sm italic text-ink-500">
        Učitavam nedeljni cilj...
      </div>
    );
  }
  if (!data) return null;

  const hasWeeklyGoal = data.week.goal_rsd > 0;
  const hasMonthlyGoal = data.month.goal_rsd > 0;

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
        <Target size={14} /> Napredak ka cilju
      </div>

      {hasWeeklyGoal && (
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-ink-800">
              Ova nedelja{" "}
              <span className="text-xs text-ink-500 font-normal tabular-nums">
                ({formatDateSr(data.week.start)} — {formatDateSr(data.week.end)})
              </span>
            </div>
            <div className="text-xs font-bold text-ink-900 tabular-nums">
              {formatPct(Math.min(999, data.week.progress_pct))}
            </div>
          </div>
          <div className="h-2 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
            <div
              className="h-full bg-ink-900 rounded-full transition-all"
              style={{
                width: `${Math.min(100, data.week.progress_pct)}%`,
              }}
            />
          </div>
          <div className="mt-1.5 text-xs text-ink-500 tabular-nums">
            Ostvareno {formatRSD(data.week.revenue_rsd)} od {formatRSD(data.week.goal_rsd)}
            {data.week.remaining_rsd > 0 && (
              <> · fali još <b>{formatRSD(data.week.remaining_rsd)}</b></>
            )}
          </div>
        </div>
      )}

      {hasMonthlyGoal && (
        <div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-ink-800">Ovaj mesec</div>
            <div className="text-xs font-bold text-ink-900 tabular-nums">
              {formatPct(Math.min(999, data.month.progress_pct))}
            </div>
          </div>
          <div className="h-2 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all"
              style={{
                width: `${Math.min(100, data.month.progress_pct)}%`,
              }}
            />
          </div>
          <div className="mt-1.5 text-xs text-ink-500 tabular-nums">
            Ostvareno {formatRSD(data.month.revenue_rsd)} od {formatRSD(data.month.goal_rsd)}
            {data.month.remaining_rsd > 0 && (
              <> · fali još <b>{formatRSD(data.month.remaining_rsd)}</b></>
            )}
          </div>
        </div>
      )}

      {!hasWeeklyGoal && !hasMonthlyGoal && (
        <p className="text-sm text-ink-500 italic">
          Master još nije postavio mesečni cilj za ovu radnju.
        </p>
      )}

      {/* 30 dana line chart */}
      <div className="pt-3 border-t border-ink-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
          <TrendingUp size={14} /> Promet poslednjih 30 dana
        </div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily} margin={{ top: 6, right: 12, bottom: 6, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("sr-RS", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                }
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(v: number) => formatRSD(v)}
                labelFormatter={(l) => formatDateSr(l)}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#111827"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
