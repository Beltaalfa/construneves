import { formatBRL } from "@/lib/format";

type MesRow = { ANO?: unknown; MES_NUM?: unknown; VALOR?: unknown };

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const VARIANT = {
  vendas: {
    label: "Emissão",
    ring: "ring-cyan-500/20",
    border: "border-cyan-500/20",
    gradient: "from-cyan-950/50 via-zinc-950/80 to-zinc-950",
    accent: "bg-cyan-500",
    accentSoft: "bg-cyan-500/15",
    text: "text-cyan-200/90",
    bullet: "●",
  },
  recebidos: {
    label: "Baixa",
    ring: "ring-emerald-500/20",
    border: "border-emerald-500/20",
    gradient: "from-emerald-950/45 via-zinc-950/80 to-zinc-950",
    accent: "bg-emerald-500",
    accentSoft: "bg-emerald-500/15",
    text: "text-emerald-200/90",
    bullet: "●",
  },
  pendentes: {
    label: "Vencimento",
    ring: "ring-amber-500/20",
    border: "border-amber-500/20",
    gradient: "from-amber-950/40 via-zinc-950/80 to-zinc-950",
    accent: "bg-amber-500",
    accentSoft: "bg-amber-500/12",
    text: "text-amber-200/90",
    bullet: "●",
  },
} as const;

type VariantKey = keyof typeof VARIANT;

function groupByAno(rows: MesRow[]) {
  const map = new Map<
    number,
    { meses: { m: number; v: number }[]; total: number }
  >();
  for (const r of rows) {
    const ano = Number(r.ANO ?? 0);
    const m = Number(r.MES_NUM ?? 0);
    const v = Number(r.VALOR ?? 0);
    if (!ano || !m) continue;
    if (!map.has(ano)) map.set(ano, { meses: [], total: 0 });
    const g = map.get(ano)!;
    const exist = g.meses.find((x) => x.m === m);
    if (exist) exist.v += v;
    else g.meses.push({ m, v });
    g.total += v;
  }
  for (const g of map.values()) {
    g.meses.sort((a, b) => a.m - b.m);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([ano, data]) => ({ ano, ...data }));
}

function MesTable({
  title,
  rows,
  valueLabel,
  variant,
}: {
  title: string;
  rows: MesRow[];
  valueLabel: string;
  variant: VariantKey;
}) {
  const v = VARIANT[variant];
  const grupos = groupByAno(rows);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border ${v.border} bg-gradient-to-b ${v.gradient} p-0 shadow-xl shadow-black/25 ring-1 ${v.ring} min-h-[14rem]`}
    >
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/[0.03] blur-2xl" />
      <div
        className={`relative border-b border-zinc-800/60 px-5 py-4 ${v.accentSoft}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">
              {title}
            </h3>
          </div>
          <span
            className="shrink-0 rounded-md border border-zinc-600/50 bg-zinc-950/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500"
            title="Critério de agrupamento mensal"
          >
            Por {v.label}
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col p-5 pt-4">
        {!grupos.length ? (
          <p className="text-sm text-zinc-500">Sem dados no período.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {grupos.map(({ ano, meses, total }) => {
              const maxMes = Math.max(
                ...meses.map((x) => x.v),
                1,
              );
              return (
                <details
                  key={ano}
                  className="overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-950/40 transition-colors open:border-zinc-700/60 open:bg-zinc-950/70"
                  open={ano === grupos[0]?.ano}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors marker:hidden hover:bg-zinc-900/40 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <span className={v.text}>{v.bullet}</span>
                      {ano}
                    </span>
                    <span
                      className={`tabular-nums text-sm font-semibold ${v.text}`}
                    >
                      {formatBRL(total)}
                    </span>
                  </summary>
                  <ul className="space-y-2.5 border-t border-zinc-800/50 px-3 py-3">
                    {meses.map(({ m, v: vv }) => {
                      const w = Math.min(100, (vv / maxMes) * 100);
                      return (
                        <li key={`${ano}-${m}`}>
                          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                            <span className="text-zinc-300">
                              {MESES_PT[m - 1] ?? `Mês ${m}`}
                            </span>
                            <span className="shrink-0 font-medium tabular-nums text-zinc-200 sm:text-sm">
                              {formatBRL(vv)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
                            <div
                              className={`h-full rounded-full ${v.accent} transition-[width] duration-500 ease-out`}
                              style={{ width: `${w}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-700/40 pt-3 text-sm font-semibold text-zinc-100">
              <span className="text-zinc-400">Total geral</span>
              <span className="tabular-nums text-base text-zinc-50 sm:text-lg">
                {formatBRL(totalGeral)}
              </span>
            </div>
            <p className="text-center text-[10px] leading-relaxed text-zinc-500">
              {valueLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReceberMonthlyTables({
  vendas,
  recebidos,
  pendentes,
}: {
  vendas: MesRow[];
  recebidos: MesRow[];
  pendentes: MesRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <MesTable
        title="Contas a receber — Vendas"
        rows={vendas}
        valueLabel="Soma de VLR_CTAREC por mês de emissão, apenas títulos em aberto."
        variant="vendas"
      />
      <MesTable
        title="Contas a receber — Recebidos"
        rows={recebidos}
        valueLabel="Soma de VLR_RECEB por mês da data da baixa (TB_CTAREC_BAIXA)."
        variant="recebidos"
      />
      <MesTable
        title="Contas a receber — Pendentes"
        rows={pendentes}
        valueLabel="Soma de VLR_RESTANTE por mês de vencimento, carteira em aberto."
        variant="pendentes"
      />
    </div>
  );
}
