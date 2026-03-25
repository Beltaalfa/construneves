"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Row = { name: string; value: number };

const PALETTE = [
  "#3b82f6",
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#eab308",
  "#a855f7",
  "#64748b",
];

export function DashboardPieChart({
  data,
  title,
}: {
  data: Row[];
  title?: string;
}) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-sm">
        Sem dados
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
      {title ? (
        <h3 className="text-sm font-medium text-zinc-300 mb-4">{title}</h3>
      ) : null}
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={PALETTE[i % PALETTE.length]}
                  stroke="#18181b"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                color: "#fafafa",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-400">
        {data.map((d, i) => (
          <li key={d.name} className="inline-flex items-center gap-1">
            <span
              className="size-2 rounded-sm"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {d.name}: {d.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
