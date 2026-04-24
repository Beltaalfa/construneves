"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TableExportXlsxButton } from "@/components/dashboard/TableExportXlsxButton";
import { Button } from "@/components/ui/Button";
import { formatInt } from "@/lib/format";
import { formatDashboardCell } from "@/lib/table-cell-format";

type Row = Record<string, unknown> & {
  ID_PED_COMPRA_ORDEM?: number;
  ID_IDENTIFICADOR?: number;
};

const COLS = [
  "ID_PED_COMPRA_ORDEM",
  "ID_IDENTIFICADOR",
  "DESCRICAO",
  "NOME_GRUPO",
  "SUGESTAO_COMPRA",
  "ULTIMO_CUSTO_COMPRA",
  "QTD_ULTIMA_COMPRA",
] as const;

const LABELS: Record<string, string> = {
  ID_PED_COMPRA_ORDEM: "Ordem",
  ID_IDENTIFICADOR: "Cód. item",
  DESCRICAO: "Produto",
  NOME_GRUPO: "Grupo",
  SUGESTAO_COMPRA: "Sugestão de compra",
  ULTIMO_CUSTO_COMPRA: "Último custo (NF compra)",
  QTD_ULTIMA_COMPRA: "Qtd. última compra",
};

export default function PedidosCompraClient({
  initialRows,
  initialCount,
  initialOrdens,
}: {
  initialRows: Row[];
  initialCount: number;
  initialOrdens: number;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [count, setCount] = useState<number>(initialCount);
  const [ordens, setOrdens] = useState<number>(initialOrdens);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [sortCol, setSortCol] = useState<string>("DESCRICAO");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const keys = useMemo(() => [...COLS], []);
  const sortedRows = useMemo(() => {
    const list = [...rows];
    const isNil = (v: unknown) => v == null || String(v).trim() === "";
    list.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (isNil(av) && isNil(bv)) return 0;
      if (isNil(av)) return 1;
      if (isNil(bv)) return -1;
      const an = Number(av);
      const bn = Number(bv);
      const bothNum = Number.isFinite(an) && Number.isFinite(bn);
      const cmp = bothNum
        ? an - bn
        : String(av).localeCompare(String(bv), "pt-BR", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortCol(col);
    setSortDir("asc");
  }

  async function excluir(row: Row) {
    const idPed = Number(row.ID_PED_COMPRA_ORDEM || 0);
    const idItem = Number(row.ID_IDENTIFICADOR || 0);
    if (idPed <= 0 || idItem <= 0) {
      setToast({ ok: false, text: "Linha inválida para exclusão." });
      return;
    }
    if (!window.confirm(`Excluir item ${idItem} da ordem ${idPed}?`)) return;

    const key = `${idPed}:${idItem}`;
    setDeletingKey(key);
    setToast(null);
    try {
      const r = await fetch("/api/internal/pedidos-compra-item", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_ped_compra_ordem: idPed,
          id_identificador: idItem,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; detail?: string };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.detail || "Falha ao excluir item." });
        return;
      }
      setRows((prev) => {
        const next = prev.filter(
          (x) =>
            Number(x.ID_PED_COMPRA_ORDEM || 0) !== idPed ||
            Number(x.ID_IDENTIFICADOR || 0) !== idItem,
        );
        setCount(next.length);
        setOrdens(new Set(next.map((x) => Number(x.ID_PED_COMPRA_ORDEM || 0))).size);
        return next;
      });
      setToast({ ok: true, text: `Item ${idItem} removido da ordem ${idPed}.` });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao excluir." });
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <KpiCard label="Ordens em aberto" value={formatInt(ordens)} variant="accent" />
        <KpiCard label="Linhas (itens)" value={formatInt(count)} />
      </div>

      {toast ? (
        <div
          className={`relative rounded-xl border px-5 py-4 text-sm ${
            toast.ok
              ? "border-emerald-500/25 bg-emerald-950/20 text-emerald-200"
              : "border-red-500/25 bg-red-950/30 text-red-300"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-2 justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Itens pendentes</h3>
          <TableExportXlsxButton
            rows={rows as Record<string, unknown>[]}
            columnKeys={keys}
            fileNameBase="pedidos-compra-abertos"
          />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[min(70vh,640px)] overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-xs sm:text-sm min-w-[720px] md:min-w-[960px] lg:min-w-[1080px]">
            <thead className="sticky top-0 bg-zinc-950/95 z-10 backdrop-blur-sm">
              <tr className="border-b border-zinc-700/50">
                {keys.map((k) => (
                  <th
                    key={k}
                    className="text-left font-medium text-zinc-400 px-3 py-2.5 whitespace-nowrap"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-zinc-200"
                      onClick={() => toggleSort(k)}
                      title={`Classificar por ${LABELS[k] ?? k}`}
                    >
                      <span>{LABELS[k] ?? k}</span>
                      <span className="text-[10px] text-zinc-500">
                        {sortCol === k ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="text-left font-medium text-zinc-400 px-3 py-2.5 whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => {
                const idPed = Number(row.ID_PED_COMPRA_ORDEM || 0);
                const idItem = Number(row.ID_IDENTIFICADOR || 0);
                const key = `${idPed}:${idItem}`;
                return (
                  <tr
                    key={`${key}:${i}`}
                    className="border-b border-zinc-700/30 hover:bg-zinc-800/30"
                  >
                    {keys.map((k) => (
                      <td
                        key={k}
                        className="px-3 py-2 text-zinc-200 whitespace-nowrap max-w-[240px] truncate"
                        title={String(row[k] ?? "")}
                      >
                        {formatDashboardCell(k, row[k])}
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button
                        variant="danger"
                        loading={deletingKey === key}
                        onClick={() => void excluir(row)}
                        className="px-2.5 py-1.5 text-xs"
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={keys.length + 1} className="px-3 py-6 text-sm text-zinc-500 text-center">
                    Nenhum registro
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-zinc-500 px-3 py-2 border-t border-zinc-800">
          Total: {formatInt(rows.length)} {rows.length === 1 ? "linha" : "linhas"}
        </p>
      </div>
    </>
  );
}
