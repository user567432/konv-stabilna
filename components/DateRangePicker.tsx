"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import {
  type DateRange,
  type ComparePreset,
  QUICK_RANGES,
  maximum,
  previousPeriodOf,
  previousYearOf,
} from "@/lib/date-ranges";
import { formatDateSr } from "@/lib/format";

interface Props {
  range: DateRange;
  compare: ComparePreset;
  firstShiftDate: string | null;
  onChange: (range: DateRange, compare: ComparePreset) => void;
}

export default function DateRangePicker({
  range,
  compare,
  firstShiftDate,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>(range.start);
  const [customEnd, setCustomEnd] = useState<string>(range.end);
  const [localCompare, setLocalCompare] = useState<ComparePreset>(compare);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomStart(range.start);
    setCustomEnd(range.end);
  }, [range.start, range.end]);

  useEffect(() => {
    setLocalCompare(compare);
  }, [compare]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  function applyQuick(r: DateRange) {
    onChange(r, localCompare);
    setOpen(false);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const s = customStart < customEnd ? customStart : customEnd;
    const e = customStart < customEnd ? customEnd : customStart;
    onChange({ start: s, end: e, label: "Prilagođen raspon" }, localCompare);
    setOpen(false);
  }

  const compareRange =
    localCompare === "previous_period"
      ? previousPeriodOf(range)
      : localCompare === "previous_year"
      ? previousYearOf(range)
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-ink-200 bg-white text-sm font-semibold text-ink-900 hover:bg-ink-50"
      >
        <Calendar size={16} />
        <span className="hidden sm:inline">
          {formatDateSr(range.start)} — {formatDateSr(range.end)}
        </span>
        <span className="sm:hidden">{range.label}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] sm:w-[620px] bg-white rounded-xl shadow-lg border border-ink-100 p-4 z-30 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Brze prečice */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
              Brze prečice
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {QUICK_RANGES.map((q) => {
                const r = q.build();
                const active = r.start === range.start && r.end === range.end;
                return (
                  <button
                    type="button"
                    key={q.key}
                    onClick={() => applyQuick(r)}
                    className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                      active
                        ? "bg-ink-900 text-white"
                        : "hover:bg-ink-50 text-ink-800"
                    }`}
                  >
                    <span className="font-semibold">{r.label}</span>
                    <span
                      className={`text-xs tabular-nums ${
                        active ? "text-ink-200" : "text-ink-400"
                      }`}
                    >
                      {formatDateSr(r.start)} — {formatDateSr(r.end)}
                    </span>
                  </button>
                );
              })}
              {(() => {
                const r = maximum(firstShiftDate);
                const active = r.start === range.start && r.end === range.end;
                return (
                  <button
                    type="button"
                    key="max"
                    onClick={() => applyQuick(r)}
                    className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                      active
                        ? "bg-ink-900 text-white"
                        : "hover:bg-ink-50 text-ink-800"
                    }`}
                  >
                    <span className="font-semibold">Maksimum</span>
                    <span
                      className={`text-xs tabular-nums ${
                        active ? "text-ink-200" : "text-ink-400"
                      }`}
                    >
                      od {formatDateSr(r.start)}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Prilagođen raspon + Uporedi */}
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Prilagođen raspon
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-ink-500">Od</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="input !h-9 !text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-500">Do</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="input !h-9 !text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={applyCustom}
                className="btn-primary !h-9 !px-3 text-sm mt-2 w-full"
              >
                Primeni raspon
              </button>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                Uporedi
              </div>
              <div className="space-y-1">
                {(
                  [
                    { k: "none", label: "Bez poređenja" },
                    { k: "previous_period", label: "Prethodni period" },
                    { k: "previous_year", label: "Ista nedelja prošle godine" },
                  ] as { k: ComparePreset; label: string }[]
                ).map((opt) => {
                  const active = localCompare === opt.k;
                  return (
                    <button
                      type="button"
                      key={opt.k}
                      onClick={() => {
                        setLocalCompare(opt.k);
                        onChange(range, opt.k);
                      }}
                      className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                        active
                          ? "bg-ink-900 text-white"
                          : "hover:bg-ink-50 text-ink-800"
                      }`}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
              {compareRange && (
                <div className="text-xs text-ink-500 mt-2 tabular-nums">
                  {formatDateSr(compareRange.start)} —{" "}
                  {formatDateSr(compareRange.end)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
