"use client";

import { TableExportXlsxButton } from "@/components/dashboard/TableExportXlsxButton";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";

type Row = Record<string, unknown>;

const MESES_PT = [
  "",
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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sumMetrics(rows: Row[]) {
  return {
    CONTAGEM_NF: rows.reduce((s, r) => s + num(r.CONTAGEM_NF), 0),
    QUANTIDADE: rows.reduce((s, r) => s + num(r.QUANTIDADE), 0),
    VALOR_ITENS: rows.reduce((s, r) => s + num(r.VALOR_ITENS), 0),
    DESCONTO: rows.reduce((s, r) => s + num(r.DESCONTO), 0),
    TOTAL_LIQUIDO: rows.reduce((s, r) => s + num(r.TOTAL_LIQUIDO), 0),
    MARGEM_BRUTA_RS: rows.reduce((s, r) => s + num(r.MARGEM_BRUTA_RS), 0),
  };
}

function cellsFor(m: ReturnType<typeof sumMetrics>) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
        {formatInt(m.CONTAGEM_NF)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
        {formatNumber(m.QUANTIDADE, 2)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
        {formatBRL(m.VALOR_ITENS)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
        {formatBRL(m.DESCONTO)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-100 font-medium">
        {formatBRL(m.TOTAL_LIQUIDO)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-cyan-400/90">
        {formatBRL(m.MARGEM_BRUTA_RS)}
      </td>
    </>
  );
}

export function SalesHierarchyTable({
  rows,
  mode,
  exportFileName,
  title,
}: {
  rows: Row[];
  mode: "vendedor" | "produto";
  exportFileName: string;
  title?: string;
}) {
  const leafLabel = (r: Row) =>
    mode === "vendedor"
      ? String(r.NOME_VENDEDOR ?? "")
      : String(r.PRODUTO ?? "");

  const byAno = new Map<number, Map<number, Row[]>>();
  for (const r of rows) {
    const ano = num(r.ANO);
    const mes = num(r.MES_NUM);
    if (!ano || !mes) continue;
    if (!byAno.has(ano)) byAno.set(ano, new Map());
    const bm = byAno.get(ano)!;
    if (!bm.has(mes)) bm.set(mes, []);
    bm.get(mes)!.push(r);
  }
  const anos = [...byAno.keys()].sort((a, b) => b - a);
  const grand = sumMetrics(rows);

  const exportCols = [
    "ANO",
    "MES_NUM",
    "MES_NOME",
    mode === "vendedor" ? "NOME_VENDEDOR" : "PRODUTO",
    "CONTAGEM_NF",
    "QUANTIDADE",
    "VALOR_ITENS",
    "DESCONTO",
    "TOTAL_LIQUIDO",
    "MARGEM_BRUTA_RS",
  ];
  const exportRows: Record<string, unknown>[] = rows.map((r) => ({
    ...r,
    MES_NOME: MESES_PT[num(r.MES_NUM)] ?? "",
  }));

  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        Nenhum registro no período.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        ) : (
          <span />
        )}
        <TableExportXlsxButton
          rows={exportRows}
          columnKeys={exportCols}
          fileNameBase={exportFileName}
        />
      </div>
      <div className="overflow-x-auto max-h-[min(560px,72vh)]">
        <table className="w-full text-xs sm:text-sm min-w-[720px]">
          <thead className="sticky top-0 bg-zinc-950/95 z-10 border-b border-zinc-800">
            <tr>
              <th className="text-left font-medium text-zinc-400 px-3 py-2.5">
                {mode === "vendedor" ? "Ano / mês / vendedor" : "Ano / mês / produto"}
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Nº vendas
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Quantidade
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Valor itens
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Desconto
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Total líquido
              </th>
              <th className="text-right font-medium text-zinc-400 px-3 py-2.5">
                Margem bruta R$
              </th>
            </tr>
          </thead>
          <tbody>
            {anos.map((ano) => {
              const mesMap = byAno.get(ano)!;
              const meses = [...mesMap.keys()].sort((a, b) => a - b);
              const yearRows = meses.flatMap((m) => mesMap.get(m) ?? []);
              const yearTot = sumMetrics(yearRows);
              return (
                <>
                  <tr
                    key={`y-${ano}`}
                    className="bg-zinc-900/90 border-b border-zinc-700/60"
                  >
                    <td className="px-3 py-2.5 font-semibold text-zinc-100">
                      {ano}
                    </td>
                    {cellsFor(yearTot)}
                  </tr>
                  {meses.map((mesNum) => {
                    const mr = mesMap.get(mesNum) ?? [];
                    const mesTot = sumMetrics(mr);
                    const mesNome = MESES_PT[mesNum] ?? String(mesNum);
                    return (
                      <>
                        <tr
                          key={`ym-${ano}-${mesNum}`}
                          className="bg-zinc-950/70 border-b border-zinc-800/50"
                        >
                          <td className="px-3 py-2 pl-6 text-zinc-300 font-medium">
                            {mesNome}
                          </td>
                          {cellsFor(mesTot)}
                        </tr>
                        {mr.map((r, i) => (
                          <tr
                            key={`${ano}-${mesNum}-d-${i}`}
                            className="border-b border-zinc-800/30 hover:bg-zinc-800/15"
                          >
                            <td className="px-3 py-1.5 pl-10 text-zinc-400 max-w-[300px] truncate">
                              {leafLabel(r)}
                            </td>
                            {cellsFor(
                              sumMetrics([
                                {
                                  CONTAGEM_NF: r.CONTAGEM_NF,
                                  QUANTIDADE: r.QUANTIDADE,
                                  VALOR_ITENS: r.VALOR_ITENS,
                                  DESCONTO: r.DESCONTO,
                                  TOTAL_LIQUIDO: r.TOTAL_LIQUIDO,
                                  MARGEM_BRUTA_RS: r.MARGEM_BRUTA_RS,
                                },
                              ]),
                            )}
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </>
              );
            })}
            <tr className="bg-zinc-800/50 font-semibold border-t-2 border-zinc-600">
              <td className="px-3 py-3 text-zinc-100">Total geral</td>
              {cellsFor(grand)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
