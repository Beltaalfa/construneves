import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatBRL, formatInt } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";
import Link from "next/link";

type Payload = {
  data_referencia?: string;
  incluir_inativas?: boolean;
  totais?: {
    qtd_contas?: number;
    saldo_disponivel?: number;
    saldo_conciliado?: number;
  };
  rows?: Record<string, unknown>[];
};

type Props = { searchParams?: Promise<{ todas?: string }> };

export default async function ContasBancariasSaldosPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const todas = sp.todas === "1";
  const qs = todas ? "?incluir_inativas=true" : "";

  let payload: Payload = {};
  let err: string | null = null;
  try {
    const res = await internalFetch(
      `/dash/financeiro/contas-bancarias/saldos${qs}`,
    );
    if (!res.ok) err = await res.text();
    else payload = await res.json();
  } catch (e) {
    err = String(e);
  }

  const t = payload.totais ?? {};
  const ref = payload.data_referencia ?? "";

  const columns = [
    "ID_CONTA",
    "DESCRICAO",
    "BANCO",
    "AGENCIA",
    "CONTA_CORRENTE",
    "STATUS",
    "TIPO_CONTA",
    "SALDO_DISPONIVEL",
    "SALDO_CONCILIADO",
    "SALDO_TALAO_CONTABIL",
    "DATA_ULTIMA_CONCILIACAO",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Saldos em contas bancárias
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Posição na data de hoje ({ref || "—"}) conforme cadastro CLIPP (
            <code className="text-zinc-500">TB_BANCO_CTA</code>): saldo
            disponível (<code className="text-zinc-500">SD_REAL</code>) e saldo
            conciliado (<code className="text-zinc-500">SD_BANCO</code>).
            Inclui também o saldo em livro (
            <code className="text-zinc-500">SD_TALAO</code>) para conferência.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs shrink-0">
          {todas ? (
            <Link
              href="/dashboard/financeiro/contas-bancarias-saldos"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-800/60"
            >
              Só contas ativas
            </Link>
          ) : (
            <Link
              href="/dashboard/financeiro/contas-bancarias-saldos?todas=1"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-800/60"
            >
              Incluir inativas
            </Link>
          )}
        </div>
      </div>

      {todas ? (
        <p className="text-xs text-amber-400/90">
          Filtro desativado: exibindo todas as contas do cadastro (qualquer
          status).
        </p>
      ) : null}

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Contas listadas"
          value={formatInt(t.qtd_contas)}
          variant="default"
        />
        <KpiCard
          label="Total saldo disponível"
          value={formatBRL(t.saldo_disponivel)}
          variant="accent"
        />
        <KpiCard
          label="Total saldo conciliado"
          value={formatBRL(t.saldo_conciliado)}
          hint="Soma de SD_BANCO; pode ficar zerado se a conciliação não atualizou o campo."
          variant="default"
        />
      </div>

      <DynamicTable
        title="Detalhe por conta"
        rows={payload.rows ?? []}
        columns={columns}
        maxHeightClass="max-h-[min(70vh,640px)]"
        exportFileName={`contas-bancarias-saldos-${ref || "hoje"}`}
      />
    </div>
  );
}
