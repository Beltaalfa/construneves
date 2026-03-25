import { DashboardPieChart } from "@/components/dashboard/DashboardPieChart";
import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatInt } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";

export default async function EstoqueGiroDashboardPage() {
  let payload: {
    kpis?: Record<string, unknown>;
    rows?: Record<string, unknown>[];
    chart_categoria_acao?: { name: string; value: number }[];
    chart_status_cobertura?: { name: string; value: number }[];
  } = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/estoque/giro");
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
          Estoque — giro e cobertura
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Baseado em{" "}
          <code className="text-zinc-500">analise_giro_estoque.sql</code>. KPIs
          de categoria refletem a amostra (até 500 linhas).
        </p>
      </div>

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Promoção (amostra)"
          value={formatInt(k.produtos_promocao)}
          variant="danger"
        />
        <KpiCard
          label="Reposição (amostra)"
          value={formatInt(k.produtos_reposicao)}
          variant="accent"
        />
        <KpiCard
          label="Parados (amostra)"
          value={formatInt(k.produtos_parados)}
          variant="warn"
        />
        <KpiCard
          label="Estável (amostra)"
          value={formatInt(k.estavel)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardPieChart
          data={payload.chart_categoria_acao ?? []}
          title="Categoria de ação (amostra)"
        />
        <DashboardPieChart
          data={payload.chart_status_cobertura ?? []}
          title="Status de cobertura (amostra)"
        />
      </div>

      <DynamicTable
        title="Itens (amostra)"
        rows={payload.rows ?? []}
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
        maxHeightClass="max-h-[520px]"
      />
    </div>
  );
}
