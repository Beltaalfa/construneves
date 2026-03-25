import { formatBRL } from "@/lib/format";

type MesRow = { ANO?: unknown; MES_NUM?: unknown; VALOR?: unknown };

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

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
}: {
  title: string;
  rows: MesRow[];
  valueLabel: string;
}) {
  const grupos = groupByAno(rows);
  const totalGeral = grupos.reduce((s, g) => s + g.total, 0);

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/40 to-zinc-950/80 p-5 flex flex-col min-h-[12rem] shadow-lg shadow-black/15">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3 tracking-tight">
        {title}
      </h3>
      {!grupos.length ? (
        <p className="text-sm text-zinc-500">Sem dados no período.</p>
      ) : (
        <div className="space-y-2 text-sm flex-1 overflow-y-auto max-h-[420px] pr-1">
          {grupos.map(({ ano, meses, total }) => (
            <details
              key={ano}
              className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 hover:border-cyan-900/40 transition-colors"
              open={ano === grupos[0]?.ano}
            >
              <summary className="cursor-pointer select-none px-3 py-2.5 text-zinc-200 font-medium flex justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
                <span>{ano}</span>
                <span className="tabular-nums text-zinc-400">
                  {formatBRL(total)}
                </span>
              </summary>
              <ul className="px-3 pb-2 pt-0 space-y-1 border-t border-zinc-800/60">
                {meses.map(({ m, v }) => (
                  <li
                    key={`${ano}-${m}`}
                    className="flex justify-between gap-2 text-zinc-400 pl-2"
                  >
                    <span className="capitalize">{MESES_PT[m - 1] ?? m}</span>
                    <span className="tabular-nums text-zinc-300">
                      {formatBRL(v)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <div className="flex justify-between gap-2 pt-2 mt-1 border-t border-zinc-700/50 text-zinc-200 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatBRL(totalGeral)}</span>
          </div>
          <p className="text-[11px] text-zinc-500">{valueLabel}</p>
        </div>
      )}
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <MesTable
        title="Contas a receber — Vendas"
        rows={vendas}
        valueLabel="Soma de valor do título (VLR_CTAREC) por mês de emissão, títulos em aberto."
      />
      <MesTable
        title="Contas a receber — Recebidos"
        rows={recebidos}
        valueLabel="Soma de VLR_RECEB por mês da baixa (TB_CTAREC_BAIXA)."
      />
      <MesTable
        title="Contas a receber — Pendentes"
        rows={pendentes}
        valueLabel="Soma de saldo em aberto (VLR_RESTANTE) por mês de vencimento."
      />
    </div>
  );
}
