"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { formatRSD, formatDateShort } from "@/lib/format";

interface Point {
  date: string;
  revenue: number;
  conversion: number;
  aov: number;
}

export default function RevenueChart({ data }: { data: Point[] }) {
  const fmt = data.map((d) => ({ ...d, label: formatDateShort(d.date) }));

  return (
    <div className="card-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-ink-900">Promet · poslednjih 30 dana</h3>
          <p className="text-sm text-ink-500">Zbir svih radnji, po danu.</p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <AreaChart data={fmt} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v) => new Intl.NumberFormat("sr-RS", { notation: "compact" }).format(v)}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #E5E5E5",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              }}
              formatter={(v: number) => formatRSD(v)}
              labelStyle={{ color: "#0A0A0A", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#0A0A0A"
              strokeWidth={2}
              fill="url(#revGrad)"
              activeDot={{ r: 4, fill: "#0A0A0A" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
