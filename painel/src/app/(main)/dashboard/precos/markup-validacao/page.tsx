import { MarkupValidacaoClient } from "./MarkupValidacaoClient";
import { internalFetch } from "@/lib/internal-api";
import type { MarkupRow } from "@/components/dashboard/ValidationMarkupTable";

export default async function MarkupValidacaoPage() {
  let payload: {
    kpis?: Record<string, number | string | undefined>;
    rows?: MarkupRow[];
  } = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/precos/markup-validacao");
    if (!res.ok) err = await res.text();
    else payload = await res.json();
  } catch (e) {
    err = String(e);
  }

  const rows = payload.rows ?? [];
  const k = payload.kpis ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Validação de MarkUP
        </h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl">
          Compara o <strong className="text-zinc-300">MARGEM_LB</strong> cadastrado em{" "}
          <code className="text-zinc-500">TB_ESTOQUE_2</code> com o markup calculado a partir
          de <code className="text-zinc-500">PRC_CUSTO</code> e{" "}
          <code className="text-zinc-500">PRC_VENDA</code>. Tolerância:{" "}
          <strong className="text-zinc-300">0,05 p.p.</strong> — consulta:{" "}
          <code className="text-zinc-500">validacao_markup_produtos.sql</code>.
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Lista completa carregada no painel ({rows.length.toLocaleString("pt-BR")} itens). Use os
          KPIs como filtro rápido, busca por palavras na descrição e ordene clicando nos cabeçalhos.
          Margem bruta % = ((Venda − Custo) / Venda) × 100.
        </p>
      </div>

      <MarkupValidacaoClient
        initialRows={rows}
        stats={{
          total_produtos: Number(k.total_produtos ?? k.total_amostra ?? rows.length),
          divergentes: Number(k.divergentes),
          ok: Number(k.ok),
          sem_custo: Number(k.sem_custo),
          pct_divergentes: Number(k.pct_divergentes),
          margem_bruta_media_divergentes: Number(
            k.margem_bruta_media_divergentes,
          ),
          produtos_margem_bruta_menor_10: Number(k.produtos_margem_bruta_menor_10),
          maior_dif_markup_abs_pp: Number(k.maior_dif_markup_abs_pp),
          produtos_markup_calc_menor_40: Number(
            k.produtos_markup_calc_menor_40 ?? 0,
          ),
        }}
        errorText={err}
      />
    </div>
  );
}
