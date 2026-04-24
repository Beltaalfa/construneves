"use client";

import { agingBarColor, VIZ } from "@/lib/dashboard-viz-theme";
import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; valor: number };

function useNarrowChart(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(max-width: 640px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches,
    () => false,
  );
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function DashboardBarChart({
  data,
  title,
  subtitle,
  valueFormat = "number",
  chartHeight = 280,
  barPalette = "semantic",
  tooltipValueLabel = "Valor",
}: {
  data: Row[];
  title?: string;
  subtitle?: string;
  valueFormat?: "brl" | "number";
  chartHeight?: number;
  /** semantic = cores por faixa de atraso (contas a receber); uniform = uma cor (ex.: outros dashboards). */
  barPalette?: "semantic" | "uniform";
  tooltipValueLabel?: string;
}) {
  const narrow = useNarrowChart();
  const fmt =
    valueFormat === "brl"
      ? brl
      : (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/40 px-6 py-14 text-center">
        <p className="text-sm text-zinc-500">Sem dados para exibir neste gráfico.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 p-5 shadow-lg shadow-black/20">
      {title ? (
        <div className="mb-1">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          {subtitle ? (
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="w-full mt-4" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={
              narrow
                ? { top: 4, right: 8, left: 0, bottom: 4 }
                : { top: 4, right: 20, left: 4, bottom: 4 }
            }
            barCategoryGap={10}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={VIZ.grid}
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: VIZ.axisMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: VIZ.grid }}
              tickFormatter={(v) => fmt(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={narrow ? 88 : 128}
              tick={{ fill: VIZ.axis, fontSize: narrow ? 10 : 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(39, 39, 42, 0.35)" }}
              contentStyle={{
                backgroundColor: VIZ.tooltip.bg,
                border: `1px solid ${VIZ.tooltip.border}`,
                borderRadius: "10px",
                color: VIZ.tooltip.color,
                boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              }}
              formatter={(v) => [fmt(Number(v ?? 0)), tooltipValueLabel]}
              labelStyle={{ color: VIZ.axis }}
            />
            <Bar dataKey="valor" radius={[0, 8, 8, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell
                  key={`${entry.name}-${i}`}
                  fill={
                    barPalette === "uniform"
                      ? "#38bdf8"
                      : agingBarColor(entry.name)
                  }
                  fillOpacity={barPalette === "uniform" ? 0.85 : 0.92}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
