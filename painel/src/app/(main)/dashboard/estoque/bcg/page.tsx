import { DashboardPieChart } from "@/components/dashboard/DashboardPieChart";
import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatInt } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";

export default async function EstoqueBcgDashboardPage() {
  let payload: {
    kpis?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    chart_quadrantes?: { name: string; value: number }[];
  } = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/estoque/bcg");
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
          Estoque — matriz BCG (vendas)
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          <code className="text-zinc-500">matriz_bcg_produtos_2.sql</code> — até
          400 produtos na amostra.
        </p>
      </div>

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <KpiCard
          label="Produtos na amostra"
          value={formatInt(k.total_produtos)}
          variant="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardPieChart
          data={payload.chart_quadrantes ?? []}
          title="Distribuição CLASSE_BCG"
        />
        <DynamicTable
          title="Detalhe"
          rows={payload.rows ?? []}
          columns={[
            "PRODUTO",
            "REFERENCIA",
            "VALOR_ATUAL",
            "VALOR_ANTERIOR",
            "CRESCIMENTO_VENDAS_PCT",
            "PARTICIPACAO_VENDAS_CLASSIFICACAO_PCT",
            "CLASSE_BCG",
          ]}
          maxHeightClass="max-h-[480px]"
        />
      </div>
    </div>
  );
}
