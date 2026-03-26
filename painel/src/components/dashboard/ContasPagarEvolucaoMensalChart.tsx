"use client";

import { VIZ } from "@/lib/dashboard-viz-theme";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function brl(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function brlAxis(v: number) {
  if (v >= 1_000_000)
    return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`;
  if (v >= 1000)
    return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl(v);
}

type MesRow = {
  mes_num?: unknown;
  name?: unknown;
  pago?: unknown;
  a_pagar?: unknown;
};

const F_PAGO = "#38bdf8";
const F_ABERTO = "#f59e0b";

export function ContasPagarEvolucaoMensalChart({
  ano,
  data,
}: {
  ano: number;
  data: MesRow[];
}) {
  const rows = data.map((r) => ({
    name: String(r.name ?? r.mes_num ?? ""),
    pago: Number(r.pago ?? 0),
    a_pagar: Number(r.a_pagar ?? 0),
  }));

  const hasAny = rows.some((r) => r.pago > 0 || r.a_pagar > 0);

  if (!hasAny) {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 p-6 shadow-lg shadow-black/20">
        <h3 className="text-sm font-semibold text-zinc-100">
          Evolução mensal — {ano}
        </h3>
        <p className="text-xs text-zinc-500 mt-2">
          Sem pagamentos nem saldo em aberto com vencimento neste ano para exibir.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 p-5 shadow-lg shadow-black/20">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-zinc-100">
          Evolução mensal — {ano}
        </h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-3xl">
          <span className="text-sky-400/90">Pago</span>: soma das baixas (
          <code className="text-zinc-600">TB_CTAPAG_BAIXA</code>) por mês da
          data da baixa.{" "}
          <span className="text-amber-400/90">A pagar</span>: saldo em aberto
          dos títulos com vencimento naquele mês (ainda não quitados).
        </p>
      </div>
      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
            barGap={2}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={VIZ.grid}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: VIZ.axisMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: VIZ.grid }}
            />
            <YAxis
              tick={{ fill: VIZ.axisMuted, fontSize: 10 }}
              tickFormatter={(v) => brlAxis(Number(v))}
              width={64}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: VIZ.tooltip.bg,
                border: `1px solid ${VIZ.tooltip.border}`,
                borderRadius: "10px",
                color: VIZ.tooltip.color,
                fontSize: "12px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              }}
              formatter={(value, name) => [
                brl(Number(value)),
                name === "pago" ? "Pago no mês" : "A pagar (venc.)",
              ]}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              formatter={(value) =>
                value === "pago" ? "Pago no mês" : "A pagar (vencimento)"
              }
            />
            <Bar
              dataKey="pago"
              name="pago"
              fill={F_PAGO}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="a_pagar"
              name="a_pagar"
              fill={F_ABERTO}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
