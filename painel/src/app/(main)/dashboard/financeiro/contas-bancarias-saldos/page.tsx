import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatBRL, formatInt } from "@/lib/format";
import { internalFetch } from "@/lib/internal-api";
import Link from "next/link";

type TotaisSaldos = {
  qtd_contas?: number;
  saldo_disponivel?: number;
  saldo_talao_contabil?: number;
  saldo_conciliado?: number;
};

type Payload = {
  data_referencia?: string;
  incluir_inativas?: boolean;
  totais?: TotaisSaldos;
  rows?: Record<string, unknown>[];
  cartoes_receber?: { totais?: TotaisSaldos; rows?: Record<string, unknown>[] };
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
  const tc = payload.cartoes_receber?.totais ?? {};
  const ref = payload.data_referencia ?? "";

  const columns = ["DESCRICAO", "BANCO", "SALDO_DISPONIVEL"];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Saldos em contas bancárias
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Posição na data de hoje ({ref || "—"}) conforme cadastro CLIPP (
            <code className="text-zinc-500">TB_BANCO_CTA</code>
            ). A conta SIPAG (<code className="text-zinc-500">ID_CONTA=6</code>
            ) aparece em &quot;Cartões a receber&quot;, fora do total e da tabela de
            bancos.
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

      <h2 className="text-sm font-medium text-zinc-300">Bancos e caixas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Contas listadas (sem SIPAG)"
          value={formatInt(t.qtd_contas)}
          variant="default"
        />
        <KpiCard
          label="Total saldo (SD_TALAO) — bancos"
          value={formatBRL(
            t.saldo_talao_contabil ?? t.saldo_disponivel,
          )}
          hint="Soma do saldo em livro nas contas da tabela abaixo (SIPAG excluída)."
          variant="accent"
        />
      </div>

      <DynamicTable
        title="Detalhe por conta (bancos e caixas)"
        rows={payload.rows ?? []}
        columns={columns}
        maxHeightClass="max-h-[min(50vh,480px)]"
        exportFileName={`contas-bancarias-saldos-${ref || "hoje"}`}
      />

      <h2 className="text-sm font-medium text-zinc-300 pt-2">
        Cartões a receber
      </h2>
      <p className="text-xs text-zinc-500 max-w-2xl -mt-1">
        Conta de adquirente (SIPAG); saldos <code className="text-zinc-600">SD_REAL</code> /{" "}
        <code className="text-zinc-600">SD_TALAO</code> no mesmo critério do CLIPP.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Conta(s) cartão"
          value={formatInt(tc.qtd_contas ?? 0)}
          variant="default"
        />
        <KpiCard
          label="Total saldo (SD_TALAO) — cartões"
          value={formatBRL(
            tc.saldo_talao_contabil ?? tc.saldo_disponivel,
          )}
          variant="accent"
        />
      </div>
      <DynamicTable
        title="Detalhe (SIPAG / cartões a receber)"
        rows={payload.cartoes_receber?.rows ?? []}
        columns={columns}
        maxHeightClass="max-h-[min(35vh,320px)]"
        exportFileName={`contas-cartoes-receber-${ref || "hoje"}`}
      />
    </div>
  );
}
