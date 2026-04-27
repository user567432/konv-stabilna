import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "../../AdminGate";
import { createSupabaseServer } from "@/lib/supabase";
import { loadDashboard } from "@/lib/dashboard-data";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import RevenueChart from "@/components/RevenueChart";
import ConversionChart from "@/components/ConversionChart";
import WorkerLeaderboard from "@/components/WorkerLeaderboard";
import RecentShiftsTable from "@/components/RecentShiftsTable";
import { formatRSD, formatPct, formatNumber } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const supabase = createSupabaseServer();
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!store) notFound();

  const data = await loadDashboard(params.id);
  const convTarget = Number(data.globalSettings?.conversion_target ?? 15);
  const aovTarget = Number(data.globalSettings?.aov_target ?? 3000);

  return (
    <main className="min-h-screen bg-ink-50/30">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700 font-semibold"
          >
            <ArrowLeft size={16} /> Sve radnje
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded">
              {store.id}
            </span>
            <span className="text-xs text-ink-500">{store.location}</span>
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            {store.name}
          </h1>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Promet danas" value={formatRSD(data.today.revenue)} mono />
          <KpiCard
            label="Konverzija danas"
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
        </section>

        <section>
          <RevenueChart data={data.daily} />
        </section>

        <section>
          <ConversionChart data={data.daily} target={convTarget} />
        </section>

        <section>
          <WorkerLeaderboard rows={data.perWorkerPeriod} conversionTarget={convTarget} />
        </section>

        <section>
          <RecentShiftsTable rows={data.recentShifts} conversionTarget={convTarget} />
        </section>
      </div>
    </main>
  );
}
