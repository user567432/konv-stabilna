"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatPct, formatDateShort } from "@/lib/format";

interface Point {
  date: string;
  conversion: number;
}

export default function ConversionChart({
  data,
  target,
}: {
  data: Point[];
  target: number;
}) {
  const fmt = data.map((d) => ({ ...d, label: formatDateShort(d.date) }));

  return (
    <div className="card-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-ink-900">Konverzija · 30 dana</h3>
          <p className="text-sm text-ink-500">
            Isprekidana linija = cilj ({formatPct(target)}).
          </p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={fmt} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#EEEEEE" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#737373" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#737373" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #E5E5E5",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => formatPct(v)}
            />
            <ReferenceLine y={target} stroke="#10B981" strokeDasharray="4 4" strokeWidth={1.5} />
            <Line
              type="monotone"
              dataKey="conversion"
              stroke="#0A0A0A"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#0A0A0A" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
