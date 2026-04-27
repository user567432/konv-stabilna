import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "./AdminGate";
import { loadDashboard } from "@/lib/dashboard-data";
import { loadProjection } from "@/lib/projection";
import { getWeatherForDate } from "@/lib/weather";
import { generateInsights } from "@/lib/insights";
import DashboardClient from "./DashboardClient";
import TeamRankingCard from "@/components/TeamRankingCard";
import { createSupabaseServer } from "@/lib/supabase";
import type { CalendarEvent } from "@/components/EventsBadge";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthed())) {
    return <AdminGate />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServer();

  const [data, projection, weather, eventsResult] = await Promise.all([
    loadDashboard(),
    loadProjection(),
    getWeatherForDate(today).catch(() => null),
    supabase.rpc("list_calendar_events", { p_from: today, p_to: today }),
  ]);

  const events = (eventsResult.data ?? []) as CalendarEvent[];

  const convTarget = Number(data.globalSettings?.conversion_target ?? 15);
  const aovTarget = Number(data.globalSettings?.aov_target ?? 3000);

  const insights = generateInsights({
    data,
    projection,
    weather: weather ?? null,
    convTarget,
    aovTarget,
  });

  return (
    <DashboardClient
      initial={data}
      projection={projection}
      insights={insights}
      weather={weather ?? null}
      todayEvents={events}
    >
      <TeamRankingCard days={30} />
    </DashboardClient>
  );
}
