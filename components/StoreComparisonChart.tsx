"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatRSD } from "@/lib/format";

interface Row {
  store_id: string;
  revenue: number;
}

export default function StoreComparisonChart({ data }: { data: Row[] }) {
  return (
    <div className="card-soft">
      <div className="mb-4">
        <h3 className="font-bold text-ink-900">Promet po radnji · 7 dana</h3>
        <p className="text-sm text-ink-500">Ukupan promet u poslednjih 7 dana.</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#EEEEEE" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="store_id"
              tick={{ fontSize: 12, fill: "#0A0A0A", fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#737373" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat("sr-RS", { notation: "compact" }).format(v)
              }
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #E5E5E5",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => formatRSD(v)}
              cursor={{ fill: "#F7F7F7" }}
            />
            <Bar dataKey="revenue" fill="#0A0A0A" radius={[8, 8, 0, 0]} maxBarSize={72} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
