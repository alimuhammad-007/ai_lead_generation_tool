"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type ChartDataPoint = {
  date: string;
  leads: number;
};

type TooltipPayloadEntry = { value?: number };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-gray-500">
        <span className="font-semibold text-gray-900">{val}</span> lead{val !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function LeadsChart({ data }: { data: ChartDataPoint[] }) {
  // Show every 5th label so the axis isn't crowded on 30 days
  const tickFormatter = (_: string, index: number) =>
    index % 5 === 0 ? data[index]?.date ?? "" : "";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="leads"
          stroke="#111827"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#111827", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
