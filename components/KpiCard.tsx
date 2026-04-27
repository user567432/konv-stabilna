"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";

interface Props {
  label: string;
  value: string;
  delta?: number;          // percent change vs previous period
  deltaLabel?: string;     // e.g. "vs prethodnih 7 dana"
  target?: string;         // optional target line
  targetHit?: boolean;
  mono?: boolean;
}

export default function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  target,
  targetHit,
  mono,
}: Props) {
  const hasDelta = typeof delta === "number" && isFinite(delta);
  const isUp = hasDelta && delta! > 0.5;
  const isDown = hasDelta && delta! < -0.5;
  const isFlat = hasDelta && !isUp && !isDown;

  return (
    <div className="card-soft">
      <div className="kpi-label">{label}</div>
      <div className={clsx("kpi-value", mono && "tabular-nums")}>{value}</div>

      {target && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-ink-500">Cilj:</span>
          <span
            className={clsx(
              "text-xs font-semibold tabular-nums",
              targetHit ? "text-emerald-700" : "text-ink-700"
            )}
          >
            {target}
          </span>
          {targetHit && (
            <span className="chip-success text-[10px] py-0.5">✓ dostignut</span>
          )}
        </div>
      )}

      {hasDelta && (
        <div
          className={clsx(
            "mt-3 inline-flex items-center gap-1 text-xs font-semibold",
            isUp && "text-emerald-700",
            isDown && "text-rose-700",
            isFlat && "text-ink-500"
          )}
        >
          {isUp && <TrendingUp size={14} />}
          {isDown && <TrendingDown size={14} />}
          {isFlat && <Minus size={14} />}
          <span>
            {delta! > 0 ? "+" : ""}
            {delta!.toFixed(1).replace(".", ",")}%
          </span>
          {deltaLabel && <span className="text-ink-500 font-normal ml-1">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
