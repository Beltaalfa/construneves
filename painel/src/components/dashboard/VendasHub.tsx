"use client";

import { DashboardBarChart } from "@/components/dashboard/DashboardBarChart";
import { DashboardPieChart } from "@/components/dashboard/DashboardPieChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PaginatedRemoteTable } from "@/components/dashboard/PaginatedRemoteTable";
import { SalesHierarchyTable } from "@/components/dashboard/SalesHierarchyTable";
import { TableExportXlsxButton } from "@/components/dashboard/TableExportXlsxButton";
import { VendasAbcBarChart } from "@/components/dashboard/VendasAbcBarChart";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { safeFetchJson } from "@/lib/safe-fetch-json";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "abc-valor", label: "ABC faturamento" },
  { id: "abc-margem", label: "ABC margem" },
  { id: "por-produto", label: "Por produto" },
  { id: "periodo-vendedor", label: "Período × vendedor" },
  { id: "periodo-produto", label: "Período × produto" },
  { id: "forma-pagamento", label: "Forma pagamento" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Kpis = Record<string, unknown>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const ABC_COLS = [
  "CLASSE_ABC",
  "PRODUTO",
  "REFERENCIA",
  "TOTAL_LIQUIDO",
  "MARGEM_BRUTA_RS",
  "MARGEM_BRUTA_PCT",
  "PCT_DO_TOTAL",
  "PCT_ACUMULADO",
  "QUANTIDADE",
  "CONTAGEM_NF",
] as const;

export function VendasHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabRaw = searchParams.get("tab") || "resumo";
  const tab = TABS.some((t) => t.id === tabRaw)
    ? (tabRaw as TabId)
    : "resumo";

  const setTab = useCallback(
    (id: TabId) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", id);
      router.push(`?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState<string>("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("ano", String(ano));
    if (mes) p.set("mes", mes);
    return p.toString();
  }, [ano, mes]);

  const extraTableParams = useMemo(() => {
    const e: Record<string, string | number> = { ano };
    if (mes) e.mes = Number(mes);
    return e;
  }, [ano, mes]);

  const [resumo, setResumo] = useState<{
    kpis?: Kpis;
    serie_mensal?: Record<string, unknown>[];
    top_clientes?: Record<string, unknown>[];
    mix_grupo?: Record<string, unknown>[];
  } | null>(null);
  const [resumoErr, setResumoErr] = useState<string | null>(null);

  const [abcValor, setAbcValor] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [abcMargem, setAbcMargem] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [abcErr, setAbcErr] = useState<string | null>(null);

  const [hierVend, setHierVend] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [hierProd, setHierProd] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [hierErr, setHierErr] = useState<string | null>(null);

  const [forma, setForma] = useState<{
    rows?: Record<string, unknown>[];
    total_pagto?: number;
  } | null>(null);
  const [formaErr, setFormaErr] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "resumo") return;
    let cancel = false;
    (async () => {
      const r = await safeFetchJson<{
        kpis?: Kpis;
        serie_mensal?: Record<string, unknown>[];
        top_clientes?: Record<string, unknown>[];
        mix_grupo?: Record<string, unknown>[];
      }>(`/api/dash/vendas/resumo?${qs}`);
      if (cancel) return;
      if (!r.ok) {
        setResumoErr(r.error);
        setResumo(null);
        return;
      }
      setResumoErr(null);
      setResumo(r.data);
    })();
    return () => {
      cancel = true;
    };
  }, [tab, qs]);

  useEffect(() => {
    if (tab !== "abc-valor" && tab !== "abc-margem") return;
    let cancel = false;
    const base = tab === "abc-margem" ? "margem" : "valor";
    (async () => {
      const r = await safeFetchJson<{ rows?: Record<string, unknown>[] }>(
        `/api/dash/vendas/abc?${qs}&base=${base}`,
      );
      if (cancel) return;
      if (!r.ok) {
        setAbcErr(r.error);
        setAbcValor(null);
        setAbcMargem(null);
        return;
      }
      setAbcErr(null);
      if (base === "valor") setAbcValor(r.data.rows ?? []);
      else setAbcMargem(r.data.rows ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [tab, qs]);

  useEffect(() => {
    if (tab !== "periodo-vendedor" && tab !== "periodo-produto") return;
    let cancel = false;
    (async () => {
      const path =
        tab === "periodo-vendedor"
          ? "vendas/por-periodo-vendedor"
          : "vendas/por-periodo-produto";
      const r = await safeFetchJson<{ rows?: Record<string, unknown>[] }>(
        `/api/dash/${path}?${qs}`,
      );
      if (cancel) return;
      if (!r.ok) {
        setHierErr(r.error);
        setHierVend(null);
        setHierProd(null);
        return;
      }
      setHierErr(null);
      if (tab === "periodo-vendedor") setHierVend(r.data.rows ?? []);
      else setHierProd(r.data.rows ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [tab, qs]);

  useEffect(() => {
    if (tab !== "forma-pagamento") return;
    let cancel = false;
    (async () => {
      const r = await safeFetchJson<{
        rows?: Record<string, unknown>[];
        total_pagto?: number;
      }>(`/api/dash/vendas/por-forma-pagamento?${qs}`);
      if (cancel) return;
      if (!r.ok) {
        setFormaErr(r.error);
        setForma(null);
        return;
      }
      setFormaErr(null);
      setForma(r.data);
    })();
    return () => {
      cancel = true;
    };
  }, [tab, qs]);

  const k = resumo?.kpis ?? {};
  const serieChart = useMemo(() => {
    const s = resumo?.serie_mensal ?? [];
    return s.map((r) => ({
      name: `${String(r.ANO ?? "")}-${String(r.MES_NUM ?? "").padStart(2, "0")}`,
      valor: num(r.TOTAL_LIQUIDO),
    }));
  }, [resumo?.serie_mensal]);

  const mixPie = useMemo(() => {
    const m = resumo?.mix_grupo ?? [];
    return m
      .filter((r) => num(r.TOTAL_LIQUIDO) > 0)
      .slice(0, 12)
      .map((r) => ({
        name: `Grupo ${r.ID_GRUPO}`,
        value: num(r.TOTAL_LIQUIDO),
      }));
  }, [resumo?.mix_grupo]);

  const abcRows = tab === "abc-margem" ? abcMargem : abcValor;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Vendas
        </h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-xl">
          NFs finalizadas por data de saída. Totais por item; formas de pagamento no faturamento da NF.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end rounded-xl border border-zinc-700/50 bg-zinc-900/20 p-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Ano
          <select
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 min-w-[100px]"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Mês (opcional)
          <select
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-200 min-w-[140px]"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          >
            <option value="">Todos</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-3 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-white"
                : "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" ? (
        <div className="space-y-8">
          {resumoErr ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {resumoErr}
            </div>
          ) : null}
          {!resumo && !resumoErr ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : null}
          {resumo ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Notas fiscais"
                  value={formatInt(k.QTD_NF)}
                  variant="accent"
                />
                <KpiCard
                  label="Total líquido (itens)"
                  value={formatBRL(k.TOTAL_LIQUIDO)}
                />
                <KpiCard
                  label="Margem bruta R$"
                  value={formatBRL(k.MARGEM_BRUTA_RS)}
                  variant="default"
                />
                <KpiCard
                  label="Margem %"
                  value={`${formatNumber(k.MARGEM_BRUTA_PCT, 2)}%`}
                />
                <KpiCard
                  label="Ticket médio / NF"
                  value={formatBRL(k.TICKET_MEDIO_NF)}
                  hint="Total líquido ÷ qtd NF"
                />
                <KpiCard
                  label="Desconto itens"
                  value={formatBRL(k.DESCONTO_ITENS)}
                />
                <KpiCard
                  label="Desconto NF (cab.)"
                  value={formatBRL(k.DESCONTO_NF_CABECALHO)}
                />
                <KpiCard label="Qtd itens" value={formatInt(k.QTD_LINHAS_ITENS)} />
              </div>
              <DashboardBarChart
                data={serieChart}
                title="Faturamento líquido por mês"
                valueFormat="brl"
                barPalette="uniform"
                tooltipValueLabel="Total líquido"
              />
              {mixPie.length ? (
                <DashboardPieChart
                  data={mixPie}
                  title="Mix por grupo de produto (top 12)"
                />
              ) : null}
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center gap-2">
                  <h3 className="text-sm font-medium text-zinc-300">
                    Top clientes (faturamento líquido)
                  </h3>
                  <TableExportXlsxButton
                    rows={(resumo.top_clientes ?? []) as Record<string, unknown>[]}
                    columnKeys={[
                      "ID_CLIENTE",
                      "NOME_CLIENTE",
                      "QTD_NF",
                      "TOTAL_LIQUIDO",
                      "MARGEM_BRUTA_RS",
                    ]}
                    fileNameBase={`vendas-top-clientes-${ano}`}
                  />
                </div>
                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800">
                      <tr>
                        <th className="text-left px-3 py-2 text-zinc-400">Cliente</th>
                        <th className="text-right px-3 py-2 text-zinc-400">NFs</th>
                        <th className="text-right px-3 py-2 text-zinc-400">
                          Total líquido
                        </th>
                        <th className="text-right px-3 py-2 text-zinc-400">
                          Margem R$
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(resumo.top_clientes ?? []).map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-zinc-800/40 hover:bg-zinc-800/20"
                        >
                          <td className="px-3 py-2 text-zinc-200 max-w-[240px] truncate">
                            {String(r.NOME_CLIENTE ?? "")}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatInt(r.QTD_NF)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(r.TOTAL_LIQUIDO)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-cyan-400/90">
                            {formatBRL(r.MARGEM_BRUTA_RS)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "abc-valor" || tab === "abc-margem" ? (
        <div className="space-y-6">
          {abcErr ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {abcErr}
            </div>
          ) : null}
          {!abcRows && !abcErr ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : null}
          {abcRows?.length ? (
            <>
              <VendasAbcBarChart
                rows={abcRows}
                metricKey={
                  tab === "abc-margem" ? "MARGEM_BRUTA_RS" : "TOTAL_LIQUIDO"
                }
                valueLabel={
                  tab === "abc-margem" ? "Margem bruta R$" : "Total líquido"
                }
              />
              <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-medium text-zinc-300">
                    Curva ABC (80/15/5 cumulativo) —{" "}
                    {tab === "abc-margem" ? "por margem" : "por faturamento"}
                  </h3>
                  <TableExportXlsxButton
                    rows={abcRows as Record<string, unknown>[]}
                    columnKeys={[...ABC_COLS]}
                    fileNameBase={
                      tab === "abc-margem"
                        ? `vendas-abc-margem-${ano}`
                        : `vendas-abc-faturamento-${ano}`
                    }
                  />
                </div>
                <div className="overflow-x-auto max-h-[min(480px,60vh)]">
                  <table className="w-full text-xs sm:text-sm min-w-[800px]">
                    <thead className="sticky top-0 bg-zinc-950/95 z-10 border-b border-zinc-800">
                      <tr>
                        <th className="text-left px-3 py-2 text-zinc-400">ABC</th>
                        <th className="text-left px-3 py-2 text-zinc-400">Produto</th>
                        <th className="text-right px-3 py-2 text-zinc-400">
                          Total líquido
                        </th>
                        <th className="text-right px-3 py-2 text-zinc-400">
                          Margem R$
                        </th>
                        <th className="text-right px-3 py-2 text-zinc-400">Margem %</th>
                        <th className="text-right px-3 py-2 text-zinc-400">% total</th>
                        <th className="text-right px-3 py-2 text-zinc-400">% acum.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abcRows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-zinc-800/30 hover:bg-zinc-800/15"
                        >
                          <td className="px-3 py-1.5 font-medium text-cyan-400/90">
                            {String(r.CLASSE_ABC ?? "")}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-200 max-w-[220px] truncate">
                            {String(r.PRODUTO ?? "")}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatBRL(r.TOTAL_LIQUIDO)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatBRL(r.MARGEM_BRUTA_RS)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatNumber(r.MARGEM_BRUTA_PCT, 2)}%
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                            {formatNumber(r.PCT_DO_TOTAL, 2)}%
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-zinc-500">
                            {formatNumber(r.PCT_ACUMULADO, 2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
          {abcRows && !abcRows.length && !abcErr ? (
            <p className="text-sm text-zinc-500">Nenhum produto no período.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "por-produto" ? (
        <PaginatedRemoteTable
          key={`vendas-prod-${ano}-${mes || "all"}`}
          title="Agregado por produto"
          path="vendas/por-produto"
          columns={[
            "PRODUTO",
            "REFERENCIA",
            "CONTAGEM_NF",
            "QUANTIDADE",
            "VALOR_ITENS",
            "DESCONTO",
            "TOTAL_LIQUIDO",
            "CMV",
            "MARGEM_BRUTA_RS",
            "MARGEM_BRUTA_PCT",
          ]}
          extraParams={extraTableParams}
          defaultSortCol="TOTAL_LIQUIDO"
          defaultSortDir="DESC"
          pageSize={25}
          exportFileName={`vendas-por-produto-${ano}${mes ? `-${mes}` : ""}`}
        />
      ) : null}

      {tab === "periodo-vendedor" ? (
        <div className="space-y-4">
          {hierErr ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {hierErr}
            </div>
          ) : null}
          {!hierVend && !hierErr ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : null}
          {hierVend ? (
            <SalesHierarchyTable
              rows={hierVend}
              mode="vendedor"
              title="Vendas por ano, mês e vendedor"
              exportFileName={`vendas-periodo-vendedor-${ano}`}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "periodo-produto" ? (
        <div className="space-y-4">
          {hierErr ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {hierErr}
            </div>
          ) : null}
          {!hierProd && !hierErr ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : null}
          {hierProd ? (
            <SalesHierarchyTable
              rows={hierProd}
              mode="produto"
              title="Vendas por ano, mês e produto"
              exportFileName={`vendas-periodo-produto-${ano}`}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "forma-pagamento" ? (
        <div className="space-y-4">
          {formaErr ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {formaErr}
            </div>
          ) : null}
          {!forma && !formaErr ? (
            <p className="text-sm text-zinc-500">Carregando…</p>
          ) : null}
          {forma?.rows?.length ? (
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300">
                    Por forma de pagamento
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Total pago: {formatBRL(forma.total_pagto)} (soma das linhas de
                    pagamento)
                  </p>
                </div>
                <TableExportXlsxButton
                  rows={forma.rows as Record<string, unknown>[]}
                  columnKeys={[
                    "FORMA_PAGAMENTO",
                    "QTD_NF",
                    "QTD_LINHAS_PAGTO",
                    "TOTAL_PAGTO",
                    "PCT_DO_TOTAL",
                  ]}
                  fileNameBase={`vendas-forma-pagamento-${ano}`}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="border-b border-zinc-800 bg-zinc-950/90">
                    <tr>
                      <th className="text-left px-3 py-2 text-zinc-400">Forma</th>
                      <th className="text-right px-3 py-2 text-zinc-400">NFs</th>
                      <th className="text-right px-3 py-2 text-zinc-400">Linhas</th>
                      <th className="text-right px-3 py-2 text-zinc-400">Total</th>
                      <th className="text-right px-3 py-2 text-zinc-400">% total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forma.rows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-800/40 hover:bg-zinc-800/20"
                      >
                        <td className="px-3 py-2 text-zinc-200">
                          {String(r.FORMA_PAGAMENTO ?? "")}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatInt(r.QTD_NF)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatInt(r.QTD_LINHAS_PAGTO)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatBRL(r.TOTAL_PAGTO)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                          {formatNumber(r.PCT_DO_TOTAL, 2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {forma?.rows && !forma.rows.length && !formaErr ? (
            <p className="text-sm text-zinc-500">Sem pagamentos no período.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
