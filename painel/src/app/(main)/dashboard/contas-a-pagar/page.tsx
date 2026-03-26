import { ContasPagarEvolucaoMensalChart } from "@/components/dashboard/ContasPagarEvolucaoMensalChart";
import { ContasPagarMatrixHierarquia } from "@/components/dashboard/ContasPagarMatrixHierarquia";
import { DashboardBarChart } from "@/components/dashboard/DashboardBarChart";
import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";

type Kpis = Record<string, unknown>;

export default async function ContasPagarDashboardPage() {
  let payload: {
    kpis?: Kpis;
    rows?: Record<string, unknown>[];
    chart_top_fornecedores?: { name: string; valor: number }[];
    evolucao_mes?: Record<string, unknown>[];
    ano_evolucao_mensal?: number;
    matriz_hierarquia?: Record<string, unknown>[];
  } = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/contas-a-pagar");
    if (!res.ok) err = await res.text();
    else payload = await res.json();
  } catch (e) {
    err = String(e);
  }

  const k = payload.kpis ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Contas a pagar
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Resumo em aberto + analítico (
          <code className="text-zinc-500">contas_a_pagar_analitico.sql</code>
          ).
        </p>
      </div>

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Saldo total em aberto"
          value={formatBRL(k.SALDO_TOTAL_ABERTO)}
          variant="accent"
        />
        <KpiCard
          label="Atrasado"
          value={formatBRL(k.SALDO_ATRASADO)}
          variant="danger"
        />
        <KpiCard
          label="A vencer"
          value={formatBRL(k.SALDO_A_VENCER)}
          variant="default"
        />
        <KpiCard
          label="Títulos"
          value={formatInt(k.QTD_TITULOS)}
        />
        <KpiCard
          label="Fornecedores"
          value={formatInt(k.QTD_FORNECEDORES)}
        />
        <KpiCard
          label="Prazo médio (emisão → venc.)"
          value={`${formatNumber(k.PRAZO_MEDIO_DIAS, 1)} dias`}
          hint="Média apenas em títulos já quitados (saldo zero)"
        />
      </div>

      <ContasPagarEvolucaoMensalChart
        ano={payload.ano_evolucao_mensal ?? new Date().getFullYear()}
        data={payload.evolucao_mes ?? []}
      />

      <ContasPagarMatrixHierarquia rows={payload.matriz_hierarquia ?? []} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DashboardBarChart
          data={payload.chart_top_fornecedores ?? []}
          title="Top fornecedores — saldo em aberto (amostra analítica)"
          valueFormat="brl"
          barPalette="uniform"
          tooltipValueLabel="Saldo"
        />
        <DynamicTable
          title="Analítico (amostra)"
          rows={payload.rows ?? []}
          columns={[
            "FORNECEDOR",
            "DOCUMENTO",
            "DT_EMISSAO",
            "DT_VENCTO",
            "VALOR_TITULO",
            "VALOR_PAGO",
            "SALDO_ABERTO",
          ]}
          exportFileName="contas-a-pagar-analitico"
        />
      </div>
    </div>
  );
}
