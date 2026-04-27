import type { Insight } from "@/lib/insights";
import { Sparkles, TrendingUp, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

function iconFor(sev: Insight["severity"]) {
  switch (sev) {
    case "good":
      return <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />;
    case "warning":
      return <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />;
    case "alert":
      return <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />;
    default:
      return <Info size={18} className="text-ink-500 shrink-0 mt-0.5" />;
  }
}

export default function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="card-soft bg-gradient-to-br from-ink-50 to-white">
        <div className="flex items-center gap-2 text-ink-500">
          <Sparkles size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Zašto je danas ovako</span>
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Još nema dovoljno podataka za zaključke. Dobiješ ih čim budu unesene prve smene.
        </p>
      </div>
    );
  }

  return (
    <div className="card-soft bg-gradient-to-br from-amber-50/40 via-white to-white border-amber-200/50">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-ink-700">
          Zašto je danas ovako
        </span>
      </div>
      <ul className="space-y-2">
        {insights.map((ins, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-800">
            {iconFor(ins.severity)}
            <span>{ins.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
