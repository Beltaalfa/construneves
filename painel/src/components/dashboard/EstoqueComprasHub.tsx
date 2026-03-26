"use client";

import { DashboardPieChart } from "@/components/dashboard/DashboardPieChart";
import type { PieDatum } from "@/components/dashboard/DashboardPieChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PaginatedRemoteTable } from "@/components/dashboard/PaginatedRemoteTable";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { safeFetchJson } from "@/lib/safe-fetch-json";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type GiroResumo = {
  kpis?: Record<string, unknown>;
  chart_categoria_acao?: PieDatum[];
  chart_status_cobertura?: PieDatum[];
  chart_faixa_margem?: PieDatum[];
};

const TABS = [
  { id: "visao", label: "Visão geral" },
  { id: "cobertura", label: "Cobertura e ações" },
  { id: "compras", label: "Compras" },
  { id: "margem", label: "Margem" },
  { id: "extras", label: "Relatórios extras" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Rótulos do gráfico de status → valor no banco */
const STATUS_CHART_TO_DB: Record<string, string> = {
  Excesso: "EXCESSO",
  Critico: "CRITICO",
  Alerta: "ALERTA",
  Estavel: "ESTAVEL",
  "Sem giro": "SEM GIRO",
};

/** Rótulos do gráfico de faixa → FAIXA_MARGEM */
const FAIXA_CHART_TO_DB: Record<string, string> = {
  "< 20%": "< 20%",
  "20% - 40%": "20% - 40%",
  "40% - 60%": "40% - 60%",
  ">= 60%": ">= 60%",
  "Sem venda": "SEM VENDA",
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function EstoqueComprasHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabRaw = searchParams.get("tab") || "visao";
  const tab = TABS.some((t) => t.id === tabRaw)
    ? (tabRaw as TabId)
    : "visao";

  const setTab = useCallback(
    (id: TabId) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", id);
      router.push(`?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [giroResumo, setGiroResumo] = useState<GiroResumo | null>(null);
  const [hubErr, setHubErr] = useState<string | null>(null);

  /** Filtros vindos de KPI / gráfico (aplicados a todas as tabelas de giro). */
  const [filterCategoriaAcao, setFilterCategoriaAcao] = useState<string | null>(
    null,
  );
  const [filterStatusCobertura, setFilterStatusCobertura] = useState<
    string | null
  >(null);
  const [filterFaixaMargem, setFilterFaixaMargem] = useState<string | null>(null);
  const [filterSaldoNegativo, setFilterSaldoNegativo] = useState(false);
  const [filterSugestaoGtZero, setFilterSugestaoGtZero] = useState(false);

  const giroExtra = useMemo(() => {
    const e: Record<string, string | boolean | undefined> = {};
    if (filterCategoriaAcao) e.categoria_acao = filterCategoriaAcao;
    if (filterStatusCobertura) e.status_cobertura = filterStatusCobertura;
    if (filterFaixaMargem) e.faixa_margem = filterFaixaMargem;
    if (filterSaldoNegativo) e.saldo_negativo_only = true;
    if (filterSugestaoGtZero) e.sugestao_gt_zero = true;
    return e;
  }, [
    filterCategoriaAcao,
    filterStatusCobertura,
    filterFaixaMargem,
    filterSaldoNegativo,
    filterSugestaoGtZero,
  ]);

  const clearChartFilters = useCallback(() => {
    setFilterCategoriaAcao(null);
    setFilterStatusCobertura(null);
    setFilterFaixaMargem(null);
    setFilterSaldoNegativo(false);
    setFilterSugestaoGtZero(false);
  }, []);

  const toggleCategoria = useCallback((v: string) => {
    setFilterCategoriaAcao((p) => (p === v ? null : v));
    setTab("cobertura");
  }, [setTab]);

  const toggleStatus = useCallback((chartLabel: string) => {
    const db = STATUS_CHART_TO_DB[chartLabel];
    if (!db) return;
    setFilterStatusCobertura((p) => (p === db ? null : db));
    setTab("cobertura");
  }, [setTab]);

  const toggleFaixa = useCallback((chartLabel: string) => {
    const db = FAIXA_CHART_TO_DB[chartLabel];
    if (!db) return;
    setFilterFaixaMargem((p) => (p === db ? null : db));
    setTab("margem");
  }, [setTab]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const a1 = await safeFetchJson<GiroResumo>("/api/dash/estoque/giro-resumo");
      if (cancel) return;
      if (!a1.ok) {
        setHubErr(a1.error);
        setGiroResumo(null);
        return;
      }
      setHubErr(null);
      setGiroResumo(a1.data);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const k = giroResumo?.kpis ?? {};

  const hasChartFilters =
    filterCategoriaAcao != null ||
    filterStatusCobertura != null ||
    filterFaixaMargem != null ||
    filterSaldoNegativo ||
    filterSugestaoGtZero;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filterCategoriaAcao) parts.push(`Ação: ${filterCategoriaAcao}`);
    if (filterStatusCobertura) parts.push(`Status: ${filterStatusCobertura}`);
    if (filterFaixaMargem) parts.push(`Faixa margem: ${filterFaixaMargem}`);
    if (filterSaldoNegativo) parts.push("Saldo negativo");
    if (filterSugestaoGtZero) parts.push("Com sugestão de compra");
    return parts;
  }, [
    filterCategoriaAcao,
    filterStatusCobertura,
    filterFaixaMargem,
    filterSaldoNegativo,
    filterSugestaoGtZero,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Estoque e compras
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Material de construção — indicadores alinhados ao giro/cobertura (SQL{" "}
          <code className="text-zinc-500">analise_giro_estoque</code>
          ). Clique em KPIs ou gráficos para filtrar as tabelas. Contagem física:
          integração pendente no CLIPP.
        </p>
      </div>

      {hubErr ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {hubErr}
        </div>
      ) : null}

      {hasChartFilters ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm">
          <span className="text-zinc-300">
            <span className="text-blue-400 font-medium">Filtros ativos:</span>{" "}
            {filterSummary.join(" · ")}
          </span>
          <button
            type="button"
            onClick={clearChartFilters}
            className="ml-auto px-3 py-1 rounded-lg border border-zinc-600 text-zinc-200 hover:bg-zinc-800 text-xs"
          >
            Limpar filtros do gráfico/KPI
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-white"
                : "px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "visao" ? (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">
              Inventário lógico (estoque cadastrado)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <KpiCard
                label="SKUs (produtos)"
                value={formatInt(num(k.total_produtos))}
                variant="accent"
                onClick={() => {
                  clearChartFilters();
                  setTab("cobertura");
                }}
                hint="Limpar filtros de gráfico e abrir tabela"
              />
              <KpiCard
                label="Saldo negativo (itens)"
                value={formatInt(num(k.qtd_saldo_negativo))}
                variant="danger"
                onClick={() => {
                  setFilterSaldoNegativo((p) => !p);
                  setTab("cobertura");
                }}
                selected={filterSaldoNegativo}
              />
              <KpiCard
                label="Valor estoque estimado"
                value={formatBRL(k.total_valor_estoque_estimado)}
              />
              <KpiCard
                label="Vendas na janela (R$)"
                value={formatBRL(k.total_valor_vendas_janela)}
              />
              <KpiCard
                label="Margem bruta média (janela)"
                value={`${formatNumber(num(k.margem_bruta_media_pct), 2)}%`}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Contagem física / “já contados” / novos cadastros: requer tabelas de
              inventário no ERP — não mapeadas ainda neste painel.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">
              Recomendações de ação
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Promoção (sem giro c/ estoque)"
                value={formatInt(num(k.produtos_promocao))}
                variant="danger"
                onClick={() => toggleCategoria("Produtos para Promocao")}
                selected={filterCategoriaAcao === "Produtos para Promocao"}
              />
              <KpiCard
                label="Reposição"
                value={formatInt(num(k.produtos_reposicao))}
                variant="accent"
                onClick={() => toggleCategoria("Produtos para Reposicao")}
                selected={filterCategoriaAcao === "Produtos para Reposicao"}
              />
              <KpiCard
                label="Parados"
                value={formatInt(num(k.produtos_parados))}
                variant="warn"
                onClick={() => toggleCategoria("Produtos Parados")}
                selected={filterCategoriaAcao === "Produtos Parados"}
              />
              <KpiCard
                label="Estáveis"
                value={formatInt(num(k.estavel))}
                onClick={() => toggleCategoria("Estavel")}
                selected={filterCategoriaAcao === "Estavel"}
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">
              Cobertura (status)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard
                label="Excesso"
                value={formatInt(num(k.cobertura_excesso))}
                variant="danger"
                onClick={() => {
                  const v = "EXCESSO";
                  setFilterStatusCobertura((p) => (p === v ? null : v));
                  setTab("cobertura");
                }}
                selected={filterStatusCobertura === "EXCESSO"}
              />
              <KpiCard
                label="Crítico"
                value={formatInt(num(k.cobertura_critico))}
                variant="warn"
                onClick={() => {
                  const v = "CRITICO";
                  setFilterStatusCobertura((p) => (p === v ? null : v));
                  setTab("cobertura");
                }}
                selected={filterStatusCobertura === "CRITICO"}
              />
              <KpiCard
                label="Alerta"
                value={formatInt(num(k.cobertura_alerta))}
                variant="warn"
                onClick={() => {
                  const v = "ALERTA";
                  setFilterStatusCobertura((p) => (p === v ? null : v));
                  setTab("cobertura");
                }}
                selected={filterStatusCobertura === "ALERTA"}
              />
              <KpiCard
                label="Estável"
                value={formatInt(num(k.cobertura_estavel))}
                variant="accent"
                onClick={() => {
                  const v = "ESTAVEL";
                  setFilterStatusCobertura((p) => (p === v ? null : v));
                  setTab("cobertura");
                }}
                selected={filterStatusCobertura === "ESTAVEL"}
              />
              <KpiCard
                label="Média dias em estoque"
                value={formatNumber(num(k.media_estoque_em_dias), 1)}
                hint="Indicador agregado — sem filtro por clique"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardPieChart
              data={giroResumo?.chart_categoria_acao ?? []}
              title="Categoria de ação"
              onSliceClick={(d) => toggleCategoria(d.name)}
            />
            <DashboardPieChart
              data={giroResumo?.chart_status_cobertura ?? []}
              title="Status de cobertura"
              onSliceClick={(d) => toggleStatus(d.name)}
            />
          </div>
        </div>
      ) : null}

      {tab === "cobertura" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardPieChart
              data={giroResumo?.chart_categoria_acao ?? []}
              title="Categoria de ação"
              onSliceClick={(d) => toggleCategoria(d.name)}
            />
            <DashboardPieChart
              data={giroResumo?.chart_status_cobertura ?? []}
              title="Status de cobertura"
              onSliceClick={(d) => toggleStatus(d.name)}
            />
          </div>
          <PaginatedRemoteTable
            title="Itens — cobertura e ações"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "REFERENCIA",
              "QUANT_ESTOQUE",
              "QUANT_VENDAS",
              "VALOR_VENDAS",
              "VALOR_ESTOQUE_ESTIMADO",
              "ULTIMA_VENDA",
              "STATUS_COBERTURA",
              "CATEGORIA_ACAO",
              "ESTOQUE_EM_DIAS",
            ]}
            extraParams={giroExtra}
            defaultSortCol="ITEM"
            defaultSortDir="ASC"
            pageSize={25}
            exportFileName="estoque-cobertura-acoes"
          />
        </div>
      ) : null}

      {tab === "compras" ? (
        <PaginatedRemoteTable
          title="Sugestão de compra e níveis"
          path="estoque/giro-itens"
          columns={[
            "ITEM",
            "REFERENCIA",
            "ID_GRUPO",
            "QUANT_ESTOQUE",
            "VENDA_DIA_MEDIA",
            "ESTOQUE_IDEAL",
            "SUGESTAO_COMPRA_QTD",
            "VALOR_ESTOQUE_ESTIMADO",
            "CMV_ESTIMADO",
            "STATUS_COBERTURA",
          ]}
          extraParams={giroExtra}
          defaultSortCol="SUGESTAO_COMPRA_QTD"
          defaultSortDir="DESC"
          pageSize={25}
          exportFileName="estoque-sugestao-compra"
        />
      ) : null}

      {tab === "margem" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
            <KpiCard
              label="Margem bruta média (janela)"
              value={`${formatNumber(num(k.margem_bruta_media_pct), 2)}%`}
              variant="accent"
            />
            <KpiCard
              label="Itens margem &lt; 20% (com venda)"
              value={formatInt(num(k.produtos_margem_lt_20))}
              variant="danger"
              onClick={() => {
                const v = "< 20%";
                setFilterFaixaMargem((p) => (p === v ? null : v));
              }}
              selected={filterFaixaMargem === "< 20%"}
            />
            <KpiCard
              label="Com sugestão de compra"
              value={formatInt(num(k.produtos_com_sugestao_compra))}
              onClick={() => {
                setFilterSugestaoGtZero((p) => !p);
                setTab("compras");
              }}
              selected={filterSugestaoGtZero}
            />
          </div>
          <DashboardPieChart
            data={giroResumo?.chart_faixa_margem ?? []}
            title="Distribuição por faixa de margem"
            onSliceClick={(d) => toggleFaixa(d.name)}
          />
          <PaginatedRemoteTable
            title="Detalhe por item"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "REFERENCIA",
              "QUANT_VENDAS",
              "VALOR_VENDAS",
              "CMV_ESTIMADO",
              "FAIXA_MARGEM",
              "MARGEM_BRUTA_PCT",
              "MARKUP_PCT",
              "MARGEM_BRUTA_RS",
              "QUANT_ESTOQUE",
            ]}
            extraParams={giroExtra}
            defaultSortCol="MARGEM_BRUTA_PCT"
            defaultSortDir="DESC"
            pageSize={25}
            exportFileName="estoque-margem-itens"
          />
        </div>
      ) : null}

      {tab === "extras" ? (
        <div className="space-y-8">
          <PaginatedRemoteTable
            title="Itens parados (sem giro recente com estoque)"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "QUANT_ESTOQUE",
              "DIAS_SEM_VENDA",
              "CATEGORIA_ACAO",
              "VALOR_ESTOQUE_ESTIMADO",
            ]}
            extraParams={{
              ...giroExtra,
              categoria_acao: "Produtos Parados",
            }}
            defaultSortCol="DIAS_SEM_VENDA"
            defaultSortDir="DESC"
            pageSize={25}
            exportFileName="estoque-itens-parados"
          />
          <PaginatedRemoteTable
            title="Prioridade de reposição (sugestão &gt; 0)"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "QUANT_ESTOQUE",
              "SUGESTAO_COMPRA_QTD",
              "ESTOQUE_IDEAL",
              "VENDA_DIA_MEDIA",
              "STATUS_COBERTURA",
            ]}
            extraParams={{ ...giroExtra, sugestao_gt_zero: true }}
            defaultSortCol="SUGESTAO_COMPRA_QTD"
            defaultSortDir="DESC"
            pageSize={25}
            exportFileName="estoque-prioridade-reposicao"
          />
          <PaginatedRemoteTable
            title="Cobertura crítica"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "QUANT_ESTOQUE",
              "ESTOQUE_EM_DIAS",
              "VENDA_DIA_MEDIA",
              "STATUS_COBERTURA",
              "CATEGORIA_ACAO",
            ]}
            extraParams={{ ...giroExtra, status_cobertura: "CRITICO" }}
            defaultSortCol="ESTOQUE_EM_DIAS"
            defaultSortDir="ASC"
            pageSize={25}
            exportFileName="estoque-cobertura-critica"
          />
          <PaginatedRemoteTable
            title="Curva ABC simples (por valor de estoque estimado)"
            path="estoque/giro-itens"
            columns={[
              "ITEM",
              "VALOR_ESTOQUE_ESTIMADO",
              "QUANT_ESTOQUE",
              "VALOR_VENDAS",
              "QUANT_VENDAS",
            ]}
            extraParams={giroExtra}
            defaultSortCol="VALOR_ESTOQUE_ESTIMADO"
            defaultSortDir="DESC"
            pageSize={25}
            exportFileName="estoque-curva-abc-estoque"
          />
        </div>
      ) : null}
    </div>
  );
}
