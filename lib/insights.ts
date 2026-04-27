import type { DashboardSummary } from "./dashboard-data";
import type { ProjectionSummary } from "./projection";
import type { WeatherDay } from "./weather";

/**
 * Rule-based insight generator — gleda današnje brojke, poredi sa period-nim prosekom
 * i projekcijom, pa vraća 3-5 kratkih rečenica koje MASTER treba da vidi na vrhu.
 *
 * Bez LLM-a, deterministički. Svaki insight ima severity (info/good/warning/alert).
 */

export type InsightSeverity = "info" | "good" | "warning" | "alert";

export interface Insight {
  severity: InsightSeverity;
  text: string;
}

interface Input {
  data: DashboardSummary;
  projection: ProjectionSummary;
  weather?: WeatherDay | null;
  convTarget: number;
  aovTarget: number;
}

export function generateInsights(input: Input): Insight[] {
  const { data, projection, weather, convTarget, aovTarget } = input;
  const insights: Insight[] = [];

  const todayRev = data.today.revenue;
  const todayConv = data.today.conversion;
  const todayAov = data.today.aov;
  const periodConv = data.period.conversion;
  const periodAov = data.period.aov;

  // 1) Run-rate vs cilj (mesečna projekcija)
  const total = projection.total;
  if (total.target !== null && total.pct_of_target !== null) {
    const pct = total.pct_of_target;
    if (pct >= 100) {
      insights.push({
        severity: "good",
        text: `Na trenutnom tempu, mesec se završava na ${Math.round(pct)}% cilja — ${formatK(total.projected_month)} od ${formatK(total.target)} RSD.`,
      });
    } else if (pct >= 90) {
      insights.push({
        severity: "info",
        text: `Projekcija meseca: ${Math.round(pct)}% cilja. Potrebno ${formatK(total.required_daily_pace ?? 0)}/dan narednih ${total.days_remaining} dana da bi se cilj pogodio.`,
      });
    } else {
      insights.push({
        severity: "warning",
        text: `Zaostaje se za mesečnim ciljem (projekcija ${Math.round(pct)}%). Da bi se stigao cilj, potrebno ${formatK(total.required_daily_pace ?? 0)}/dan u narednih ${total.days_remaining} dana.`,
      });
    }
  }

  // 2) Radnja koja najviše zaostaje
  const laggers = projection.per_store
    .filter((p) => p.target !== null && p.pct_of_target !== null)
    .sort((a, b) => (a.pct_of_target ?? 0) - (b.pct_of_target ?? 0));
  if (laggers.length > 0 && (laggers[0].pct_of_target ?? 0) < 85) {
    const p = laggers[0];
    insights.push({
      severity: "alert",
      text: `${p.store_id} je najniži u mesecu — projekcija ${Math.round(p.pct_of_target ?? 0)}% cilja. Run rate ${formatK(p.run_rate_daily)}/dan, treba ${formatK(p.required_daily_pace ?? 0)}/dan da bi stigao.`,
    });
  }

  // 3) Konverzija danas vs target
  if (data.today.entries > 0) {
    if (todayConv >= convTarget) {
      insights.push({
        severity: "good",
        text: `Konverzija danas ${todayConv.toFixed(1)}% — iznad cilja od ${convTarget}%.`,
      });
    } else if (todayConv > 0 && todayConv < convTarget * 0.8) {
      insights.push({
        severity: "warning",
        text: `Konverzija danas ${todayConv.toFixed(1)}% — ispod cilja za ${(convTarget - todayConv).toFixed(1)} p.p. Ulasci su ${data.today.entries} ali prodajemo samo ${data.today.buyers}.`,
      });
    }
  }

  // 4) AOV danas
  if (data.today.buyers > 0) {
    if (todayAov >= aovTarget * 1.1) {
      insights.push({
        severity: "good",
        text: `Prosečna vrednost računa ${formatK(todayAov)} — ${Math.round(((todayAov - aovTarget) / aovTarget) * 100)}% iznad cilja.`,
      });
    } else if (todayAov > 0 && todayAov < aovTarget * 0.85) {
      insights.push({
        severity: "warning",
        text: `Prosečna vrednost računa danas ${formatK(todayAov)} je ispod cilja. Fokus na upsell i dodatne artikle.`,
      });
    }
  }

  // 5) Period vs today — trend detekcija
  if (periodConv > 0 && data.today.entries > 0) {
    const diff = todayConv - periodConv;
    if (Math.abs(diff) >= 3) {
      if (diff > 0) {
        insights.push({
          severity: "good",
          text: `Konverzija danas (${todayConv.toFixed(1)}%) je ${diff.toFixed(1)} p.p. iznad 7-dnevnog proseka. Šta radimo drugačije danas — to je odgovor.`,
        });
      } else {
        insights.push({
          severity: "warning",
          text: `Konverzija danas (${todayConv.toFixed(1)}%) je ${Math.abs(diff).toFixed(1)} p.p. ispod 7-dnevnog proseka.`,
        });
      }
    }
  }

  // 6) Radnice koje rade izvanredno (sortirane po revenue, gledamo konverziju)
  const sortedByConv = [...data.perWorkerPeriod]
    .filter((w) => w.shifts >= 3)
    .sort((a, b) => b.conversion - a.conversion);
  const topWorker = sortedByConv[0];
  if (topWorker && topWorker.conversion >= convTarget * 1.15) {
    insights.push({
      severity: "info",
      text: `${topWorker.worker_initials} (${topWorker.store_id}) vodi sa konverzijom ${topWorker.conversion.toFixed(1)}% u 7 dana — ${Math.round(((topWorker.conversion - periodConv) / Math.max(periodConv, 1)) * 100)}% iznad proseka. Pitaj šta radi.`,
    });
  }

  // 7) Vreme uticaj
  if (weather) {
    if ((weather.precipitation ?? 0) > 5) {
      insights.push({
        severity: "info",
        text: `Danas ${weather.summary?.toLowerCase() ?? "kiša"} (${weather.precipitation}mm) — očekivano manje ulazaka u Dušanovu, proveri mall.`,
      });
    } else if ((weather.temp_max ?? 0) >= 28) {
      insights.push({
        severity: "info",
        text: `Danas ${Math.round(weather.temp_max ?? 0)}°C — vrući dani tipično obaraju promet popodnevne smene.`,
      });
    }
  }

  // Ograniči na 5 najvažnijih
  return insights.slice(0, 5);
}

function formatK(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M RSD`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k RSD`;
  return `${Math.round(n)} RSD`;
}
