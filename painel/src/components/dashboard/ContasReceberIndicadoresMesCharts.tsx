"use client";

import { formatBRL, formatNumber, formatPercentFrac } from "@/lib/format";
import { VIZ } from "@/lib/dashboard-viz-theme";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MESES_CURTO = [
  "",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function mesLabel(ano: number, mes: number) {
  const m = MESES_CURTO[mes] ?? String(mes);
  return `${m}/${String(ano).slice(-2)}`;
}

type MesRow = {
  ANO?: unknown;
  MES_NUM?: unknown;
  VALOR_VENCIDO_30_MAIS?: unknown;
  INADIMPLENCIA_30_FRAC?: unknown;
  PMR_EMISSAO_BAIXA_DIAS?: unknown;
};

function tooltipStyle() {
  return {
    backgroundColor: VIZ.tooltip.bg,
    border: `1px solid ${VIZ.tooltip.border}`,
    borderRadius: "10px",
    color: VIZ.tooltip.color,
    fontSize: "12px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
  } as const;
}

function MiniAreaBlock({
  title,
  subtitle,
  data,
  dataKey,
  gradientId,
  stroke,
  yTickFormatter,
  tooltipFormatter,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  gradientId: string;
  stroke: string;
  yTickFormatter: (v: number) => string;
  tooltipFormatter: (v: number) => string;
}) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/40 p-5 min-h-[260px] flex flex-col justify-center">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-500 mt-2">Sem dados no período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/45 to-zinc-950/90 p-5 shadow-lg shadow-black/15 flex flex-col h-full min-h-[280px]">
      <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{title}</h3>
      {subtitle ? (
        <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{subtitle}</p>
      ) : null}
      <div className="flex-1 min-h-[200px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={VIZ.grid}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: VIZ.axisMuted, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: VIZ.grid }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fill: VIZ.axisMuted, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => yTickFormatter(Number(v))}
            />
            <Tooltip
              contentStyle={tooltipStyle()}
              formatter={(v) => [tooltipFormatter(Number(v)), ""]}
              labelStyle={{ color: VIZ.axis }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: stroke, stroke: "#18181b", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ContasReceberIndicadoresMesCharts({ data }: { data: MesRow[] }) {
  const v30 = useMemo(() => {
    return data.map((r) => ({
      name: mesLabel(Number(r.ANO ?? 0), Number(r.MES_NUM ?? 0)),
      valorV30: Number(r.VALOR_VENCIDO_30_MAIS ?? 0),
    }));
  }, [data]);

  const inad = useMemo(() => {
    return data.map((r) => ({
      name: mesLabel(Number(r.ANO ?? 0), Number(r.MES_NUM ?? 0)),
      inadimplFrac: Number(r.INADIMPLENCIA_30_FRAC ?? 0),
    }));
  }, [data]);

  const pmr = useMemo(() => {
    return data
      .filter((r) => r.PMR_EMISSAO_BAIXA_DIAS != null)
      .map((r) => ({
        name: mesLabel(Number(r.ANO ?? 0), Number(r.MES_NUM ?? 0)),
        pmrDias: Number(r.PMR_EMISSAO_BAIXA_DIAS ?? 0),
      }));
  }, [data]);

  const s = VIZ.series;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <MiniAreaBlock
        gradientId="cr-fill-v30"
        stroke={s.monetary.stroke}
        title="Valor vencido 30+ dias"
        subtitle="Por mês de vencimento dos títulos em aberto (corte na data de hoje)."
        data={v30}
        dataKey="valorV30"
        yTickFormatter={(v) =>
          v >= 1_000_000
            ? `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Mi`
            : formatBRL(v)
        }
        tooltipFormatter={(v) => formatBRL(v)}
      />
      <MiniAreaBlock
        gradientId="cr-fill-inad"
        stroke={s.percent.stroke}
        title="Inadimplência 30+"
        subtitle="Saldo com atraso ≥30 dias ÷ saldo total, por mês de vencimento."
        data={inad}
        dataKey="inadimplFrac"
        yTickFormatter={(v) => formatPercentFrac(v, 1)}
        tooltipFormatter={(v) => formatPercentFrac(v, 2)}
      />
      <MiniAreaBlock
        gradientId="cr-fill-pmr"
        stroke={s.days.stroke}
        title="PMR emissão → baixa"
        subtitle="Média de dias (baixa − emissão) por mês da baixa."
        data={pmr}
        dataKey="pmrDias"
        yTickFormatter={(v) => formatNumber(v, 1)}
        tooltipFormatter={(v) => `${formatNumber(v, 2)} dias`}
      />
    </div>
  );
}
