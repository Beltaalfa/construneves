import { ContasReceberClientesTitulos } from "@/components/dashboard/ContasReceberClientesTitulos";
import { ContasReceberIndicadoresMesCharts } from "@/components/dashboard/ContasReceberIndicadoresMesCharts";
import { DashboardBarChart } from "@/components/dashboard/DashboardBarChart";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ReceberMonthlyTables } from "@/components/dashboard/ReceberMonthlyTables";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";

type Kpis = Record<string, unknown>;

type MesRow = { ANO?: unknown; MES_NUM?: unknown; VALOR?: unknown };

type IndicadorMesRow = {
  ANO?: unknown;
  MES_NUM?: unknown;
  VALOR_VENCIDO_30_MAIS?: unknown;
  INADIMPLENCIA_30_FRAC?: unknown;
  PMR_EMISSAO_BAIXA_DIAS?: unknown;
};

export default async function ContasReceberDashboardPage() {
  let payload: {
    kpis?: Kpis;
    por_cliente?: Record<string, unknown>[];
    titulos?: Record<string, unknown>[];
    chart_tempo_atraso?: { name: string; valor: number }[];
    mes_vendas?: MesRow[];
    mes_recebidos?: MesRow[];
    mes_pendentes?: MesRow[];
    indicadores_mes?: IndicadorMesRow[];
  } = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/contas-a-receber");
    if (!res.ok) err = await res.text();
    else payload = await res.json();
  } catch (e) {
    err = String(e);
  }

  const k = payload.kpis ?? {};

  return (
    <div className="relative min-h-0 space-y-12 pb-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(34,211,238,0.08),transparent_55%)] opacity-90"
      />

      <header className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-950 px-6 py-8 sm:px-8 shadow-xl shadow-black/25">
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(6,182,212,0.06)_50%,transparent_60%)]" />
        <div className="relative max-w-3xl space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/90">
            Financeiro
          </p>
          <h1 className="text-3xl font-semibold text-zinc-50 tracking-tight">
            Contas a receber
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Visão da carteira em aberto: KPIs, envelhecimento, tendências mensais,
            clientes com drill-down nos títulos e conciliação por mês.
          </p>
        </div>
      </header>

      {err ? (
        <div className="relative rounded-2xl border border-red-500/25 bg-red-950/30 px-5 py-4 text-red-300 text-sm">
          {err}
        </div>
      ) : null}

      <DashboardSection
        eyebrow="Carteira"
        title="Indicadores principais"
        description="Totais consolidados na data de hoje. Saldo atrasado acima de 30 e 60 dias considera apenas títulos vencidos além desses limites."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Saldo em aberto"
            value={formatBRL(k.SALDO_ABERTO)}
            variant="accent"
          />
          <KpiCard
            label="Atrasado"
            value={formatBRL(k.SALDO_ATRASADO)}
            variant="danger"
          />
          <KpiCard label="A vencer" value={formatBRL(k.SALDO_A_VENCER)} />
          <KpiCard
            label="Prazo médio (título)"
            value={`${formatNumber(k.PRAZO_MEDIO_TITULO_DIAS, 1)} dias`}
          />
          <KpiCard label="Títulos" value={formatInt(k.QTD_TITULOS)} />
          <KpiCard label="Clientes" value={formatInt(k.QTD_CLIENTES)} />
          <KpiCard
            label="Saldo em atraso acima de 30 dias"
            value={formatBRL(k.VALOR_ATRASO_ACIMA_30_DIAS)}
            hint={`${formatInt(k.QTD_CLIENTES_ATRASO_ACIMA_30_DIAS)} clientes`}
            variant="warn"
          />
          <KpiCard
            label="Saldo em atraso acima de 60 dias"
            value={formatBRL(k.VALOR_ATRASO_ACIMA_60_DIAS)}
            hint={`${formatInt(k.QTD_CLIENTES_ATRASO_ACIMA_60_DIAS)} clientes`}
            variant="danger"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        eyebrow="Envelhecimento"
        title="Tempo de atraso"
        description="Distribuição do saldo em aberto por faixa de dias em relação ao vencimento. Cores seguem severidade (a vencer → crítico)."
      >
        <DashboardBarChart
          data={payload.chart_tempo_atraso ?? []}
          title="Saldo por faixa"
          subtitle="Barras horizontais; valores em reais no eixo."
          valueFormat="brl"
          chartHeight={360}
          barPalette="semantic"
          tooltipValueLabel="Saldo"
        />
      </DashboardSection>

      <DashboardSection
        eyebrow="Tendência"
        title="Indicadores mensais"
        description="Três séries alinhadas lado a lado em telas largas: valores em área com gradiente para leitura mais fluida que barras isoladas."
      >
        <ContasReceberIndicadoresMesCharts
          data={payload.indicadores_mes ?? []}
        />
      </DashboardSection>

      <DashboardSection
        eyebrow="Operacional"
        title="Clientes e títulos"
        description="Resumo por cliente com expansão do analítico e paginação. Role horizontalmente se houver muitas colunas."
      >
        <ContasReceberClientesTitulos
          clientes={payload.por_cliente ?? []}
          titulos={payload.titulos ?? []}
        />
      </DashboardSection>

      <DashboardSection
        eyebrow="Conciliação"
        title="Fluxo mensal"
        description="Vendas (emissão), recebidos (data da baixa) e pendentes por mês de vencimento — ano atual e anterior."
      >
        <ReceberMonthlyTables
          vendas={payload.mes_vendas ?? []}
          recebidos={payload.mes_recebidos ?? []}
          pendentes={payload.mes_pendentes ?? []}
        />
      </DashboardSection>
    </div>
  );
}
