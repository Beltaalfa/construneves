"use client";

import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { DynamicTable } from "@/components/dashboard/DynamicTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatBRL, formatInt, formatNumber, formatPercentFrac } from "@/lib/format";
import { safeFetchJson } from "@/lib/safe-fetch-json";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Tipo = "compras" | "vendas";

type Kpis = {
  total_mt?: number;
  total_clipp?: number;
  gap?: number;
  count_produtos?: number;
  count_meia_nota?: number;
  count_sem_clipp?: number;
  count_sem_mt?: number;
  count_alertas_estoque?: number;
  de?: string;
  ate?: string;
  limiar_meia_pct?: number;
  limiar_meia_vlr?: number;
  explicado?: string;
};

const COLS: string[] = [
  "ID_IDENTIFICADOR",
  "DESCRICAO",
  "REFERENCIA",
  "QTD_ESTOQUE",
  "VLR_MT",
  "VLR_CLIPP",
  "GAP_VLR",
  "GAP_FRAC",
  "SITUACAO",
  "ALERTA_MT_SEM_CLIPP_ESTOQUE",
  "ALERTA_COMPRA_MT_SEM_CLIPP_ESTOQUE",
];

const RECON_COL_LABELS: Record<string, string> = {
  ID_IDENTIFICADOR: "Código do item",
  DESCRICAO: "Descrição",
  REFERENCIA: "Referência",
  QTD_ESTOQUE: "Estoque",
  VLR_MT: "Valor (móvel)",
  VLR_CLIPP: "Valor (sistema)",
  GAP_VLR: "Diferença (R$)",
  GAP_FRAC: "Diferença (%)",
  SITUACAO: "Situação",
  ALERTA_MT_SEM_CLIPP_ESTOQUE: "Atenção venda + estoque",
  ALERTA_COMPRA_MT_SEM_CLIPP_ESTOQUE: "Atenção compra + estoque",
};

function labelSituacao(s: string | null | undefined): string {
  if (!s) return "—";
  if (s === "sem_mt") return "Só no sistema (nada no móvel)";
  if (s === "sem_clipp") return "Só no móvel (nada no sistema)";
  if (s === "meia_nota") return "Diferença (arredondamento de nota)";
  if (s === "alinhado") return "Valores próximos";
  return s;
}

export function ReconciliacaoGerFiscalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = (searchParams.get("tipo") || "compras").toLowerCase() as Tipo;
  const tipo: Tipo = t === "vendas" ? "vendas" : "compras";
  const now = new Date();
  const anoP = parseInt(searchParams.get("ano") || String(now.getFullYear()), 10);
  const mesP = parseInt(searchParams.get("mes") || String(now.getMonth() + 1), 10);
  const ano = Number.isFinite(anoP) && anoP >= 2000 ? anoP : now.getFullYear();
  const mes = Number.isFinite(mesP) && mesP >= 1 && mesP <= 12 ? mesP : now.getMonth() + 1;

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setQuery = useCallback(
    (p: { tipo?: Tipo; ano?: number; mes?: number }) => {
      const n = new URLSearchParams(searchParams.toString());
      if (p.tipo != null) n.set("tipo", p.tipo);
      if (p.ano != null) n.set("ano", String(p.ano));
      if (p.mes != null) n.set("mes", String(p.mes));
      router.push(`?${n.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      setErr(null);
      const r = await safeFetchJson<{
        kpis?: Kpis;
        rows?: Record<string, unknown>[];
      }>(`/api/dash/reconciliacao-ger-fiscal?tipo=${encodeURIComponent(
        tipo,
      )}&ano=${ano}&mes=${mes}`);
      if (cancel) return;
      if (!r.ok) {
        setErr(r.error);
        setKpis(null);
        setRows([]);
        setLoading(false);
        return;
      }
      setKpis(r.data?.kpis ?? null);
      setRows(
        (r.data?.rows ?? []).map((row: Record<string, unknown>) => {
          const sit = String(row.SITUACAO ?? "");
          return {
            ...row,
            SITUACAO: labelSituacao(sit),
            GAP_FRAC:
              typeof row.GAP_FRAC === "number"
                ? formatPercentFrac(row.GAP_FRAC)
                : row.GAP_FRAC,
            VLR_MT: formatBRL(row.VLR_MT),
            VLR_CLIPP: formatBRL(row.VLR_CLIPP),
            GAP_VLR: formatBRL(row.GAP_VLR),
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [tipo, ano, mes]);

  return (
    <div className="space-y-10 w-full min-w-0">
      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 min-w-0 w-full sm:w-auto sm:min-w-[12rem]">
          Tipo
          <select
            className="rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 w-full sm:w-auto min-w-0"
            value={tipo}
            onChange={(e) =>
              setQuery({ tipo: e.target.value as Tipo, ano, mes })
            }
          >
            <option value="compras">Compras (entrada de mercadoria)</option>
            <option value="vendas">Vendas (saída de mercadoria)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 w-full sm:w-auto">
          Ano
          <input
            type="number"
            className="w-full sm:w-24 rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
            value={ano}
            min={2000}
            max={2100}
            onChange={(e) => setQuery({ tipo, ano: Number(e.target.value), mes })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 w-full sm:w-auto">
          Mês
          <select
            className="rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 w-full sm:w-auto min-w-0"
            value={mes}
            onChange={(e) => setQuery({ tipo, ano, mes: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        {loading ? (
          <span className="text-xs text-zinc-500">A carregar…</span>
        ) : null}
      </div>

      {kpis ? (
        <DashboardSection
          eyebrow="Resumo do mês"
          title="Totais e alertas (por item)"
          description={kpis.explicado}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total no móvel"
              value={formatBRL(kpis.total_mt)}
              hint={`Período ${kpis.de ?? "—"} a ${kpis.ate ?? "—"}`}
            />
            <KpiCard
              label="Total no sistema"
              value={formatBRL(kpis.total_clipp)}
              variant="accent"
            />
            <KpiCard
              label="Diferença (móvel − sistema)"
              value={formatBRL(kpis.gap)}
              hint="Positivo: no móvel saiu um valor maior; negativo: no sistema saiu maior"
            />
            <KpiCard
              label="Itens com movimento"
              value={formatInt(kpis.count_produtos ?? 0)}
            />
            <KpiCard
              label="Diferença fora do esperado (nota “meia”)"
              value={formatInt(kpis.count_meia_nota ?? 0)}
              hint={
                "Margem de tolerância: " +
                formatNumber((kpis.limiar_meia_pct ?? 0) * 100, 0) +
                " % e R$ " +
                formatNumber(kpis.limiar_meia_vlr, 0)
              }
            />
            <KpiCard
              label="Apenas no móvel"
              value={formatInt(kpis.count_sem_clipp ?? 0)}
            />
            <KpiCard
              label="Apenas no sistema"
              value={formatInt(kpis.count_sem_mt ?? 0)}
            />
            <KpiCard
              label="Atenção: divergência com estoque ainda em posse"
              value={formatInt(kpis.count_alertas_estoque ?? 0)}
              variant="warn"
            />
          </div>
        </DashboardSection>
      ) : null}

      <DynamicTable
        title="Detalhe por item"
        rows={rows as Record<string, unknown>[]}
        columns={COLS}
        columnLabels={RECON_COL_LABELS}
        maxHeightClass="max-h-[min(70vh,600px)]"
        exportFileName={`reconciliacao-${tipo}-${ano}-${String(mes).padStart(2, "0")}`}
      />
    </div>
  );
}
