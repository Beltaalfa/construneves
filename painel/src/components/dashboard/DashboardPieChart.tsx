"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type PieDatum = { name: string; value: number };

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
  onSliceClick,
}: {
  data: PieDatum[];
  title?: string;
  /** Clique na fatia ou na legenda aplica filtro (ex.: tabela). */
  onSliceClick?: (row: PieDatum) => void;
}) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-sm">
        Sem dados
      </div>
    );
  }

  const interactive = Boolean(onSliceClick);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
      {title ? (
        <h3 className="text-sm font-medium text-zinc-300 mb-4">{title}</h3>
      ) : null}
      <div className="h-[min(260px,50vw)] w-full min-h-[200px]">
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
              cursor={interactive ? "pointer" : undefined}
              onClick={(d) => {
                if (!onSliceClick || !d || typeof d !== "object") return;
                const name = (d as { name?: string }).name;
                const value = Number((d as { value?: unknown }).value);
                if (name != null)
                  onSliceClick({ name: String(name), value: Number.isFinite(value) ? value : 0 });
              }}
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
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onSliceClick?.(d)}
              className={
                interactive
                  ? "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors text-left"
                  : "inline-flex items-center gap-1"
              }
            >
              <span
                className="size-2 rounded-sm shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {d.name}: {d.value}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
