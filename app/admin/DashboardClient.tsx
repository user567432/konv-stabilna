"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabase";
import type { DashboardSummary } from "@/lib/dashboard-data";
import KpiCard from "@/components/KpiCard";
import RevenueChart from "@/components/RevenueChart";
import ConversionChart from "@/components/ConversionChart";
import StoreComparisonChart from "@/components/StoreComparisonChart";
import WorkerLeaderboard from "@/components/WorkerLeaderboard";
import StoreCards from "@/components/StoreCards";
import RecentShiftsTable from "@/components/RecentShiftsTable";
import ResetDayButton from "@/components/ResetDayButton";
import InsightsPanel from "@/components/InsightsPanel";
import ProjectionPanel from "@/components/ProjectionPanel";
import WeatherBadge from "@/components/WeatherBadge";
import EventsBadge, { type CalendarEvent } from "@/components/EventsBadge";
import type { ProjectionSummary } from "@/lib/projection";
import type { Insight } from "@/lib/insights";
import type { WeatherDay } from "@/lib/weather";
import { formatRSD, formatPct, formatNumber } from "@/lib/format";
import { LogOut, Settings, Calendar, BarChart3, History, Trophy, Database, TrendingUp } from "lucide-react";

type Data = DashboardSummary;

export default function DashboardClient({
  initial,
  projection,
  insights = [],
  weather = null,
  todayEvents = [],
  children,
}: {
  initial: Data;
  projection?: ProjectionSummary;
  insights?: Insight[];
  weather?: WeatherDay | null;
  todayEvents?: CalendarEvent[];
  children?: React.ReactNode;
}) {
  const [data, setData] = useState<Data>(initial);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const router = useRouter();

  const convTarget = Number(data.globalSettings?.conversion_target ?? 15);
  const aovTarget = Number(data.globalSettings?.aov_target ?? 3000);

  // Real-time: na bilo koji INSERT u shifts, refresh-uj dashboard (server)
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel("shifts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => {
          router.refresh();
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // When server refreshes the page (via router.refresh), initial se menja
  useEffect(() => {
    setData(initial);
    setLastUpdate(new Date());
  }, [initial]);

  async function logout() {
    await fetch("/api/admin-login", { method: "DELETE" });
    router.refresh();
  }

  // Deltas (today vs yesterday-ish period)
  const revenueDelta = useMemo(() => {
    const prev = data.previousPeriod.revenue;
    if (prev === 0) return 0;
    return ((data.period.revenue - prev) / prev) * 100;
  }, [data]);

  const convDelta = useMemo(() => {
    const prev = data.previousPeriod.conversion;
    if (prev === 0) return 0;
    return data.period.conversion - prev; // percentage points, show as delta
  }, [data]);

  return (
    <main className="min-h-screen bg-ink-50/30">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Dušan Stil"
                width={32}
                height={32}
                priority
              />
              <span className="font-bold text-ink-900">Dušan Stil</span>
            </Link>
            <span className="hidden sm:inline text-ink-300">/</span>
            <span className="hidden sm:inline text-ink-700 font-semibold">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-ink-500">
              Osveženo: {lastUpdate.toLocaleTimeString("sr-RS")}
            </span>
            <Link href="/admin/analitika" className="btn-ghost !h-9 !px-3 text-sm">
              <BarChart3 size={16} /> Analitika
            </Link>
            <Link href="/admin/svi-unosi" className="btn-ghost !h-9 !px-3 text-sm">
              <Database size={16} /> Svi unosi
            </Link>
            <Link href="/tim-rang" className="btn-ghost !h-9 !px-3 text-sm">
              <Trophy size={16} /> Tim rang
            </Link>
            <Link href="/admin/poredjenje" className="btn-ghost !h-9 !px-3 text-sm">
              <TrendingUp size={16} /> Poređenje
            </Link>
            <Link href="/admin/istorija" className="btn-ghost !h-9 !px-3 text-sm">
              <History size={16} /> Istorija
            </Link>
            <Link href="/admin/podesavanja" className="btn-ghost !h-9 !px-3 text-sm">
              <Settings size={16} /> Podešavanja
            </Link>
            <button onClick={logout} className="btn-ghost !h-9 !px-3 text-sm">
              <LogOut size={16} /> Odjavi se
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">
        {/* Title */}
        <section>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pregled</h1>
              <p className="mt-1 text-ink-500">
                Uživo — Sve 4 radnje · Današnji pazar i 7-dnevni trend
              </p>
            </div>
            {weather && (
              <div className="rounded-xl bg-white border border-ink-100 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                  Niš · danas
                </div>
                <WeatherBadge weather={weather} />
              </div>
            )}
          </div>
          {todayEvents && todayEvents.length > 0 && (
            <div className="mt-4">
              <EventsBadge events={todayEvents} />
            </div>
          )}
        </section>

        {/* Insights panel (auto-zaključci) */}
        {insights.length > 0 && <InsightsPanel insights={insights} />}

        {/* Projekcija meseca */}
        {projection && <ProjectionPanel projection={projection} />}

        {/* Top KPIs - today */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            Danas
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Promet"
              value={formatRSD(data.today.revenue)}
              mono
            />
            <KpiCard
              label="Konverzija"
              value={formatPct(data.today.conversion)}
              target={formatPct(convTarget)}
              targetHit={data.today.conversion >= convTarget}
              mono
            />
            <KpiCard
              label="Prosečna vrednost računa"
              value={formatRSD(data.today.aov)}
              target={formatRSD(aovTarget)}
              targetHit={data.today.aov >= aovTarget}
              mono
            />
            <KpiCard
              label="Ulasci · Broj računa"
              value={`${formatNumber(data.today.entries)} · ${formatNumber(data.today.buyers)}`}
              mono
            />
          </div>
        </section>

        {/* Store cards - today */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            Po radnjama · Danas
          </h2>
          <StoreCards
            rows={data.perStoreToday}
            conversionTarget={convTarget}
            aovTarget={aovTarget}
          />
        </section>

        {/* Team ranking (server component injected via children) */}
        {children ? (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
              Tim rang · Poslednjih 30 dana
            </h2>
            {children}
          </section>
        ) : null}

        {/* 7-day KPIs */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            Poslednjih 7 dana
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Promet 7d"
              value={formatRSD(data.period.revenue)}
              delta={revenueDelta}
              deltaLabel="vs prethodnih 7 dana"
              mono
            />
            <KpiCard
              label="Konverzija 7d"
              value={formatPct(data.period.conversion)}
              delta={convDelta}
              deltaLabel="p.p. promene"
              target={formatPct(convTarget)}
              targetHit={data.period.conversion >= convTarget}
              mono
            />
            <KpiCard
              label="Pr. vr. rač. 7d"
              value={formatRSD(data.period.aov)}
              target={formatRSD(aovTarget)}
              targetHit={data.period.aov >= aovTarget}
              mono
            />
            <KpiCard
              label="Ukupno smena"
              value={formatNumber(data.period.shifts)}
              mono
            />
          </div>
        </section>

        {/* Charts */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart data={data.daily} />
          </div>
          <div>
            <StoreComparisonChart
              data={data.perStorePeriod.map((r) => ({
                store_id: r.store_id,
                revenue: r.revenue,
              }))}
            />
          </div>
        </section>

        <section>
          <ConversionChart data={data.daily} target={convTarget} />
        </section>

        {/* Worker leaderboard */}
        <section>
          <WorkerLeaderboard rows={data.perWorkerPeriod} conversionTarget={convTarget} />
        </section>

        {/* Recent shifts */}
        <section>
          <RecentShiftsTable
            rows={data.recentShifts}
            conversionTarget={convTarget}
          />
        </section>

        {/* Daily report + reset dana */}
        <section className="card-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-ink-900">Dnevni izveštaj</h3>
            <p className="text-sm text-ink-500">
              Detaljan prikaz po danu sa svim smenama i komentarima.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ResetDayButton today={new Date().toISOString().slice(0, 10)} />
            <Link
              href={`/admin/izvestaj/${new Date().toISOString().slice(0, 10)}`}
              className="btn-primary"
            >
              <Calendar size={16} /> Današnji izveštaj
            </Link>
          </div>
        </section>

        <footer className="text-xs text-ink-400 pt-4 border-t border-ink-100">
          Dušan Stil Dashboard · Podaci se osvežavaju uživo putem Supabase real-time kanala.
        </footer>
      </div>
    </main>
  );
}
