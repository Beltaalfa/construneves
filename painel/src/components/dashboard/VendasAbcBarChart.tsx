"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, unknown>;

function brl(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function VendasAbcBarChart({
  rows,
  metricKey,
  valueLabel,
  maxBars = 18,
}: {
  rows: Row[];
  metricKey: string;
  valueLabel: string;
  maxBars?: number;
}) {
  const data = rows.slice(0, maxBars).map((r) => ({
    name:
      String(r.PRODUTO ?? "")
        .slice(0, 22)
        .trim() || "(sem nome)",
    valor: Number(r[metricKey] ?? 0),
  }));

  if (!data.length) {
    return (
      <p className="text-sm text-zinc-500 py-6 text-center">
        Sem dados para o gráfico.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
      <p className="text-xs text-zinc-500 mb-3">
        Top {data.length} produtos por {valueLabel} (curva ABC na tabela abaixo).
      </p>
      <div className="h-[min(320px,40vh)] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickFormatter={(v) =>
                v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}k`
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#e4e4e7" }}
              formatter={(v) =>
                [brl(Number(v ?? 0)), valueLabel] as [string, string]
              }
            />
            <Bar dataKey="valor" fill="#22d3ee" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
