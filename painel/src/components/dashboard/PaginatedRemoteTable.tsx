"use client";

import { Button } from "@/components/ui/Button";
import { downloadRowsAsXlsx } from "@/lib/export-xlsx";
import { formatInt } from "@/lib/format";
import { safeFetchJson } from "@/lib/safe-fetch-json";
import { formatDashboardCell } from "@/lib/table-cell-format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_EXPORT_ROWS = 50_000;
/** Deve ser ≤ 100 (validação da API em painel-api/dashboard.py). */
const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_PAGES = Math.ceil(MAX_EXPORT_ROWS / EXPORT_PAGE_SIZE);

type Row = Record<string, unknown>;

function buildQueryString(
  page: number,
  pageSize: number,
  extra: Record<string, string | number | boolean | undefined | null>,
  sortCol: string | undefined,
  sortDir: "ASC" | "DESC",
): string {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("page_size", String(pageSize));
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  if (sortCol) {
    q.set("sort_col", sortCol);
    q.set("sort_dir", sortDir);
  }
  return q.toString();
}

export function PaginatedRemoteTable({
  title,
  path,
  columns,
  pageSize = 25,
  extraParams = {},
  defaultSortCol,
  defaultSortDir = "ASC",
  sortable = true,
  apiBase = "/api/dash",
  exportFileName,
}: {
  title: string;
  path: string;
  columns: string[];
  pageSize?: number;
  extraParams?: Record<string, string | number | boolean | undefined | null>;
  /** Ordenação inicial (clique no cabeçalho alterna ASC/DESC). */
  defaultSortCol?: string;
  defaultSortDir?: "ASC" | "DESC";
  sortable?: boolean;
  apiBase?: string;
  /** Base do ficheiro .xlsx (exporta todas as páginas com os mesmos filtros/ordem). */
  exportFileName?: string;
}) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [sortCol, setSortCol] = useState<string | undefined>(defaultSortCol);
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">(defaultSortDir);

  const extraKey = useMemo(() => JSON.stringify(extraParams), [extraParams]);
  const extraRef = useRef(extraParams);
  extraRef.current = extraParams;

  useEffect(() => {
    setSortCol(defaultSortCol);
    setSortDir(defaultSortDir);
  }, [defaultSortCol, defaultSortDir]);

  useEffect(() => {
    setPage(1);
  }, [extraKey, pageSize, sortCol, sortDir]);

  const onHeaderClick = useCallback(
    (col: string) => {
      if (!sortable || !columns.includes(col)) return;
      if (sortCol === col) {
        setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortCol(col);
        setSortDir("ASC");
      }
    },
    [sortable, columns, sortCol],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const activeSort =
      sortCol && columns.includes(sortCol) ? sortCol : undefined;
    const qs = buildQueryString(
      page,
      pageSize,
      extraRef.current,
      activeSort,
      sortDir,
    );
    try {
      const r = await safeFetchJson<{ total?: number; rows?: Row[] }>(
        `${apiBase}/${path}?${qs}`,
      );
      if (!r.ok) {
        setErr(r.error);
        setRows([]);
        setTotal(0);
        return;
      }
      setTotal(Number(r.data.total ?? 0));
      setRows(Array.isArray(r.data.rows) ? r.data.rows : []);
    } catch (e) {
      setErr(String(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiBase, path, page, pageSize, extraKey, sortCol, sortDir, columns]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const activeSort =
    sortCol && columns.includes(sortCol) ? sortCol : undefined;

  const runExport = useCallback(async () => {
    if (!exportFileName) return;
    setExportErr(null);
    setExporting(true);
    const all: Row[] = [];
    try {
      let p = 1;
      while (all.length < MAX_EXPORT_ROWS && p <= MAX_EXPORT_PAGES) {
        const sortForReq =
          sortCol && columns.includes(sortCol) ? sortCol : undefined;
        const qs = buildQueryString(
          p,
          EXPORT_PAGE_SIZE,
          extraRef.current,
          sortForReq,
          sortDir,
        );
        const r = await safeFetchJson<{ total?: number; rows?: Row[] }>(
          `${apiBase}/${path}?${qs}`,
        );
        if (!r.ok) {
          throw new Error(r.error);
        }
        const chunk = Array.isArray(r.data.rows) ? r.data.rows : [];
        all.push(...chunk);
        const t = Number(r.data.total ?? 0);
        if (chunk.length === 0 || all.length >= t || chunk.length < EXPORT_PAGE_SIZE) {
          break;
        }
        p += 1;
      }
      if (all.length >= MAX_EXPORT_ROWS) {
        setExportErr(
          `Exportação limitada a ${MAX_EXPORT_ROWS.toLocaleString("pt-BR")} linhas.`,
        );
      }
      downloadRowsAsXlsx(
        all as Record<string, unknown>[],
        columns,
        exportFileName,
      );
    } catch (e) {
      setExportErr(String(e));
    } finally {
      setExporting(false);
    }
  }, [exportFileName, apiBase, path, sortCol, sortDir, columns]);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
          {sortable && activeSort ? (
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Ordenação: {activeSort.replace(/_/g, " ")} ({sortDir})
            </p>
          ) : null}
          {exportErr ? (
            <p className="text-[11px] text-amber-400 mt-1">{exportErr}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportFileName && total > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              disabled={loading || exporting}
              loading={exporting}
              onClick={() => void runExport()}
            >
              Exportar XLSX
            </Button>
          ) : null}
        {totalPages > 1 || total > 0 ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>
              {from}–{to} de {formatInt(total)}
            </span>
            <button
              type="button"
              disabled={safePage <= 1 || loading}
              className="px-2 py-1 rounded-md border border-zinc-600 text-zinc-200 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              Página {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages || loading}
              className="px-2 py-1 rounded-md border border-zinc-600 text-zinc-200 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        ) : null}
        </div>
      </div>
      {err ? (
        <p className="text-sm text-red-400 px-4 py-3">{err}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500 px-4 py-8 text-center">Carregando…</p>
      ) : !rows.length ? (
        <p className="text-sm text-zinc-500 px-4 py-8 text-center">
          Nenhum registro
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[min(520px,70vh)]">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="sticky top-0 bg-zinc-950/95 z-10 backdrop-blur-sm">
              <tr className="border-b border-zinc-700/50">
                {columns.map((k) => {
                  const isActive = activeSort === k;
                  return (
                    <th
                      key={k}
                      className={
                        sortable
                          ? "text-left font-medium text-zinc-300 px-3 py-2.5 whitespace-nowrap select-none cursor-pointer hover:text-white hover:bg-zinc-800/50"
                          : "text-left font-medium text-zinc-400 px-3 py-2.5 whitespace-nowrap"
                      }
                      onClick={() => onHeaderClick(k)}
                      title={
                        sortable
                          ? "Clique para ordenar; clique de novo inverte"
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {k.replace(/_/g, " ")}
                        {sortable && isActive ? (
                          <span className="text-cyan-400" aria-hidden>
                            {sortDir === "ASC" ? "▲" : "▼"}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-700/30 hover:bg-zinc-800/30"
                >
                  {columns.map((k) => (
                    <td
                      key={k}
                      className="px-3 py-2 text-zinc-200 whitespace-nowrap max-w-[220px] truncate"
                      title={String(row[k] ?? "")}
                    >
                      {formatDashboardCell(k, row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
