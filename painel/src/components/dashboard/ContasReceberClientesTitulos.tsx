"use client";

import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { Fragment, useCallback, useMemo, useState } from "react";

type Row = Record<string, unknown>;

const MASTER_PAGE_SIZE = 25;
const DETAIL_PAGE_SIZE = 15;

function clampDetailPage(page: number, rowCount: number): number {
  const tp = Math.max(1, Math.ceil(rowCount / DETAIL_PAGE_SIZE));
  return Math.min(Math.max(1, page), tp);
}

const MASTER_KEYS = [
  "ID_CLIENTE",
  "CLIENTE",
  "PRAZO_MEDIO_EMISSAO_VENC_DIAS",
  "PMR_DIAS_VENCIMENTO_ATE_BAIXA",
  "LIBERADO",
  "LIMITE_CREDITO",
  "VALOR_RESTANTE",
  "VALOR_TITULO",
  "QTD_TITULOS",
  "VALOR_PAGO",
  "SALDO_ABERTO",
  "PRIMEIRO_VENCTO",
  "ULTIMO_VENCTO",
] as const;

const DETAIL_KEYS = [
  "DOCUMENTO",
  "DT_EMISSAO",
  "DT_VENCTO",
  "SALDO_ABERTO",
  "PRAZO_MEDIO_RECEBIMENTO_DIAS",
] as const;

function clientKey(row: Row): string {
  if (row.ID_CLIENTE != null && row.ID_CLIENTE !== "")
    return String(row.ID_CLIENTE);
  return String(row.CLIENTE ?? "").trim() || "_";
}

function formatMasterCell(key: string, val: unknown): string {
  if (val == null || val === "") return "—";
  const u = key.toUpperCase();
  if (u === "ID_CLIENTE") return formatInt(val);
  if (u.includes("LIMITE_CRED")) return formatBRL(val);
  if (u.includes("VLR") || u.includes("VALOR") || u.includes("SALDO"))
    return formatBRL(val);
  if (u.includes("QTD")) return formatInt(val);
  if (
    u.includes("PRAZO") ||
    u.includes("PMR") ||
    u.includes("DIAS") ||
    u.includes("MEDIO")
  ) {
    if (typeof val === "number") return formatNumber(val, 2);
    const n = parseFloat(String(val));
    return Number.isNaN(n) ? String(val) : formatNumber(n, 2);
  }
  if (typeof val === "number") return formatNumber(val, 2);
  return String(val);
}

function formatDetailCell(key: string, val: unknown): string {
  if (val == null) return "—";
  const u = key.toUpperCase();
  if (u.includes("SALDO")) return formatBRL(val);
  if (u.includes("PRAZO") && typeof val === "number")
    return formatNumber(val, 0);
  if (typeof val === "number") return formatNumber(val, 2);
  return String(val);
}

function TitulosTable({
  rows,
  page,
  onPageChange,
  emptyText,
  detailMaxHeightClass = "max-h-[min(50vh,360px)]",
}: {
  rows: Row[];
  page: number;
  onPageChange: (p: number) => void;
  emptyText: string;
  /** Área rolável da tabela de títulos (modal pode ser mais alto). */
  detailMaxHeightClass?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / DETAIL_PAGE_SIZE));
  const safePage = clampDetailPage(page, rows.length);
  const slice = rows.slice(
    (safePage - 1) * DETAIL_PAGE_SIZE,
    safePage * DETAIL_PAGE_SIZE,
  );

  if (!rows.length) {
    return <p className="text-xs text-zinc-500 py-2">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      <div
        className={`overflow-x-auto overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/30 ${detailMaxHeightClass}`}
      >
        <table className="w-full text-xs min-w-[520px]">
          <thead className="sticky top-0 bg-zinc-950/98 z-10 backdrop-blur-sm">
            <tr className="border-b border-zinc-700/60">
              {DETAIL_KEYS.map((k) => (
                <th
                  key={k}
                  className="text-left font-semibold text-zinc-500 text-[10px] uppercase tracking-wider px-2 py-2.5 whitespace-nowrap"
                >
                  {k.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={`${row.ID_CTAREC ?? i}-${i}`}
                className="border-b border-zinc-800/80 hover:bg-zinc-800/20"
              >
                {DETAIL_KEYS.map((k) => (
                  <td
                    key={k}
                    className="px-2 py-1.5 text-zinc-200 whitespace-nowrap max-w-[200px] truncate"
                    title={String(row[k] ?? "")}
                  >
                    {formatDetailCell(k, row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
          <span>
            {formatInt(rows.length)} título(s) — página {safePage} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-200 text-xs disabled:opacity-40 hover:bg-zinc-800/70 hover:border-zinc-500/50 transition-colors"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-200 text-xs disabled:opacity-40 hover:bg-zinc-800/70 hover:border-zinc-500/50 transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          {formatInt(rows.length)} título(s)
        </p>
      )}
    </div>
  );
}

export function ContasReceberClientesTitulos({
  clientes,
  titulos,
}: {
  clientes: Row[];
  titulos: Row[];
}) {
  const byCliente = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const t of titulos) {
      const k = clientKey(t);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const da = String(a.DT_VENCTO ?? "");
        const db = String(b.DT_VENCTO ?? "");
        return da.localeCompare(db);
      });
    }
    return m;
  }, [titulos]);

  const [masterPage, setMasterPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [detailPageByClient, setDetailPageByClient] = useState<
    Record<string, number>
  >({});

  const [modalKey, setModalKey] = useState<string | null>(null);
  const [modalPage, setModalPage] = useState(1);

  const totalMasterPages = Math.max(
    1,
    Math.ceil(clientes.length / MASTER_PAGE_SIZE),
  );
  const safeMasterPage = Math.min(masterPage, totalMasterPages);
  const masterSlice = clientes.slice(
    (safeMasterPage - 1) * MASTER_PAGE_SIZE,
    safeMasterPage * MASTER_PAGE_SIZE,
  );

  const toggleExpand = useCallback((key: string) => {
    let opening = false;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        opening = true;
        next.add(key);
      }
      return next;
    });
    if (opening) {
      setDetailPageByClient((p) => ({ ...p, [key]: 1 }));
    }
  }, []);

  const setDetailPage = useCallback((key: string, p: number) => {
    setDetailPageByClient((prev) => ({ ...prev, [key]: p }));
  }, []);

  const openModal = useCallback((key: string) => {
    setModalKey(key);
    setModalPage(1);
  }, []);

  const closeModal = useCallback(() => setModalKey(null), []);

  const modalRows = modalKey ? (byCliente.get(modalKey) ?? []) : [];
  const modalNome =
    clientes.find((c) => clientKey(c) === modalKey)?.CLIENTE ?? modalKey;

  if (!clientes.length) {
    return (
      <p className="text-sm text-zinc-500 py-6 text-center">
        Nenhum cliente com saldo em aberto.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/45 to-zinc-950/90 overflow-hidden flex flex-col shadow-lg shadow-black/20">
        <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/40">
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Clientes e títulos em aberto
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed max-w-4xl">
            Use{" "}
            <span className="text-zinc-400 font-medium">+</span> para ver o
            analítico. Abra a janela para paginar com mais espaço. Colunas
            Liberado / Limite de crédito ficam vazias até mapear campos em{" "}
            <code className="text-cyan-500/70">TB_CLIENTE</code> no SQL.
          </p>
        </div>
        <div className="overflow-auto max-h-[min(70vh,560px)]">
          <table className="w-full text-xs sm:text-sm min-w-[1280px]">
            <thead className="sticky top-0 bg-zinc-950/98 z-10 backdrop-blur-sm">
              <tr className="border-b border-zinc-700/60">
                <th className="w-10 px-1 py-2.5" aria-label="Expandir" />
                {MASTER_KEYS.map((k) => (
                  <th
                    key={k}
                    className="text-left font-semibold text-zinc-500 text-[10px] uppercase tracking-wider px-2 py-2.5 whitespace-nowrap"
                  >
                    {k.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {masterSlice.map((c) => {
                const k = clientKey(c);
                const list = byCliente.get(k) ?? [];
                const isOpen = expanded.has(k);
                const nome = String(c.CLIENTE ?? "—");

                return (
                  <Fragment key={k}>
                    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/25 transition-colors">
                      <td className="px-1 py-2 align-middle">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={
                            isOpen
                              ? `Recolher títulos de ${nome}`
                              : `Expandir títulos de ${nome}`
                          }
                          onClick={() => toggleExpand(k)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-cyan-800/50 bg-zinc-900/50 text-cyan-200 text-lg font-medium leading-none hover:bg-cyan-950/40 hover:border-cyan-500/40 transition-colors"
                        >
                          {isOpen ? "−" : "+"}
                        </button>
                      </td>
                      {MASTER_KEYS.map((col) => (
                        <td
                          key={col}
                          className="px-2 py-2 text-zinc-200 whitespace-nowrap max-w-[200px] truncate"
                          title={String(c[col] ?? "")}
                        >
                          {formatMasterCell(col, c[col])}
                        </td>
                      ))}
                    </tr>
                    {isOpen ? (
                      <tr className="bg-zinc-950/60">
                        <td
                          colSpan={MASTER_KEYS.length + 1}
                          className="px-4 py-4 border-b border-zinc-800/80"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                            <p className="text-xs text-zinc-400">
                              Títulos de{" "}
                              <span className="text-zinc-200 font-medium">
                                {nome}
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={() => openModal(k)}
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline shrink-0"
                            >
                              Abrir em janela (paginar)
                            </button>
                          </div>
                          <TitulosTable
                            rows={list}
                            page={detailPageByClient[k] ?? 1}
                            onPageChange={(p) => setDetailPage(k, p)}
                            emptyText="Nenhum título analítico para este cliente."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-zinc-800/80 bg-zinc-950/30 text-[11px] text-zinc-500">
          <span>
            {formatInt(clientes.length)} cliente(s) — página {safeMasterPage} /{" "}
            {totalMasterPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safeMasterPage <= 1}
              onClick={() => setMasterPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-200 text-xs disabled:opacity-40 hover:bg-zinc-800/70 hover:border-zinc-500/50 transition-colors"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safeMasterPage >= totalMasterPages}
              onClick={() =>
                setMasterPage((p) => Math.min(totalMasterPages, p + 1))
              }
              className="px-3 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-200 text-xs disabled:opacity-40 hover:bg-zinc-800/70 hover:border-zinc-500/50 transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {modalKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="presentation"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cr-modal-title"
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-600/60 bg-zinc-950 shadow-2xl shadow-black/50 ring-1 ring-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/30">
              <div>
                <h2
                  id="cr-modal-title"
                  className="text-sm font-semibold text-zinc-50"
                >
                  Títulos em aberto
                </h2>
                <p className="text-xs text-zinc-400 mt-1 truncate max-w-[min(100%,28rem)]">
                  {String(modalNome)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-600/80 text-zinc-200 hover:bg-zinc-800/80 hover:border-zinc-500/50 transition-colors"
              >
                Fechar
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 min-h-0">
              <TitulosTable
                rows={modalRows}
                page={modalPage}
                onPageChange={setModalPage}
                emptyText="Nenhum título."
                detailMaxHeightClass="max-h-[min(65vh,520px)]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
