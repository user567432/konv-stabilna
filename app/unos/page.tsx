import { createSupabaseServer } from "@/lib/supabase";
import { getTimStore } from "@/lib/auth";
import TimGate from "./TimGate";
import ShiftForm from "./ShiftForm";
import Link from "next/link";
import { ArrowLeft, Trophy, Target, TrendingUp } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { formatRSD, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const STORE_LABEL: Record<string, string> = {
  D1: "D1 · Ženska Dušanova",
  D2: "D2 · Muška Dušanova",
  D4: "D4 · Ženska Delta Planet",
  D5: "D5 · Muška Delta Planet",
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default async function UnosPage() {
  const myStore = await getTimStore();
  if (!myStore) {
    return <TimGate />;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const dayOfMonth = today.getDate();
  const totalDays = daysInMonth(year, month);
  const remainingDays = Math.max(1, totalDays - dayOfMonth + 1);

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}`;

  const supabase = createSupabaseServer();
  const [
    { data: stores },
    { data: workers },
    { data: storeSettings },
    { data: monthRevenueData },
  ] = await Promise.all([
    supabase.from("stores").select("*").eq("id", myStore),
    supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .eq("store_id", myStore)
      .order("initials"),
    supabase
      .from("settings")
      .select("monthly_revenue_target, conversion_target")
      .eq("store_id", myStore)
      .maybeSingle(),
    supabase
      .from("shifts")
      .select("revenue")
      .eq("store_id", myStore)
      .gte("shift_date", monthStart)
      .lte("shift_date", monthEnd),
  ]);

  const monthlyTarget =
    (storeSettings as { monthly_revenue_target: number | null } | null)
      ?.monthly_revenue_target ?? null;
  const monthRevenue = (
    (monthRevenueData ?? []) as Array<{ revenue: number | string }>
  ).reduce((sum, s) => sum + Number(s.revenue || 0), 0);

  const progressPct =
    monthlyTarget && monthlyTarget > 0 ? monthRevenue / monthlyTarget : null;
  const remaining =
    monthlyTarget && monthlyTarget > 0
      ? Math.max(0, monthlyTarget - monthRevenue)
      : 0;
  const perDay = remainingDays > 0 ? remaining / remainingDays : 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 py-8 md:py-14">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/tim"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} /> Početna
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/tim-rang"
              className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-semibold"
            >
              <Trophy size={16} /> Tim rang
            </Link>
            <LogoutButton />
          </div>
        </div>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-900 text-white">
            <span className="text-xs font-bold tracking-wider uppercase">
              TIM · {myStore}
            </span>
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-ink-900 tracking-tight">
            Novi dan
          </h1>
          <p className="mt-2 text-ink-500">
            {STORE_LABEL[myStore]}
          </p>
        </header>

        {/* Daily target banner */}
        {monthlyTarget && monthlyTarget > 0 && progressPct != null ? (
          <section className="mb-7 rounded-2xl bg-gradient-to-br from-sky-50 to-white border border-sky-100 p-5">
            <div className="flex items-start gap-3 mb-3">
              <Target className="w-6 h-6 text-sky-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider font-bold text-sky-700">
                  Mesečni cilj radnje
                </div>
                <div className="text-3xl font-bold text-ink-900 tabular-nums mt-0.5">
                  {formatPct(progressPct * 100)}
                </div>
                <div className="text-sm text-ink-700">
                  ostvareno od{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRSD(monthlyTarget)}
                  </span>{" "}
                  · trenutno{" "}
                  <span className="font-semibold tabular-nums">
                    {formatRSD(monthRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white border border-sky-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{
                  width: `${Math.min(100, progressPct * 100).toFixed(2)}%`,
                }}
              />
            </div>

            {/* Per-day calculation */}
            {remaining > 0 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <div className="flex items-start gap-2">
                  <TrendingUp size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-amber-900">
                      Do kraja meseca preostalo{" "}
                      <b className="tabular-nums">{formatRSD(remaining)}</b>{" "}
                      · još <b>{remainingDays}</b> dana
                    </div>
                    <div className="text-2xl font-bold text-ink-900 tabular-nums mt-1">
                      {formatRSD(perDay)} <span className="text-sm font-normal text-amber-800">/ dan</span>
                    </div>
                    <div className="text-xs text-amber-800 mt-1">
                      Toliko vam treba u proseku po danu da stignete cilj.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900 font-semibold">
                Bravo! Cilj je već dostignut. Sve preko ovoga ide u bonus pool.
              </div>
            )}
          </section>
        ) : (
          <section className="mb-7 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
            Mesečni cilj nije postavljen. Pitaj šefa da ga postavi u
            podešavanjima.
          </section>
        )}

        <h2 className="text-xl font-bold text-ink-900 mb-3">Upiši svoju smenu</h2>

        <ShiftForm stores={stores ?? []} workers={workers ?? []} lockedStoreId={myStore} />
      </div>
    </main>
  );
}
