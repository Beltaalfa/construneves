"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatBRL, formatInt, formatNumber } from "@/lib/format";
import { safeFetchJson } from "@/lib/safe-fetch-json";
import { useEffect, useState } from "react";

type BlocoFluxo = {
  hoje?: number;
  mtd?: number;
  mes_calendario?: number;
  /** Valor do período de comparação (mês anterior, homólogo ou mês cal. inteiro). */
  hoje_mes_passado?: number;
  mtd_mes_passado?: number;
  mes_calendario_mes_passado?: number;
  pct_mom_hoje?: number | null;
  pct_mom_mtd?: number | null;
  pct_mom_mes_calendario?: number | null;
};

type ResumoDiario = {
  data_referencia?: string;
  saldo_bancario?: {
    disponivel?: number;
    qtd_contas?: number;
    cartoes_receber?: { disponivel?: number; qtd_contas?: number };
    pct_mom?: number | null;
  };
  contas_pagar_baixas?: BlocoFluxo;
  contas_receber_baixas?: BlocoFluxo;
  vendas_liquido?: BlocoFluxo;
  totais_fluxo?: BlocoFluxo & { formula?: string };
};

/** % vs mês passado, com legenda do tipo de período (homólogo vs mês cal. fechado). */
type MomKind = "dia" | "mtd" | "cal" | "fluxDia" | "fluxMtd";

function momPct(
  p: number | null | undefined,
  kind: MomKind,
  refMesPassado?: number | null,
): string {
  const ref =
    refMesPassado != null && !Number.isNaN(Number(refMesPassado))
      ? ` · ref. ${formatBRL(refMesPassado)}`
      : "";
  if (p == null) {
    return ref ? `n/d${ref}` : "n/d";
  }
  const sign = p > 0 ? "+" : "";
  const leg: Record<MomKind, string> = {
    dia: "mesmo dia, mês passado",
    mtd: "até a mesma data, mês passado (MTD homólogo)",
    cal: "valor mês cal. corrente; % e ref. vs 1.º → mesma data no mês passado (MTD homólogo)",
    fluxDia: "fluxo, mesmo dia mês passado",
    fluxMtd: "fluxo, MTD homólogo (1.º → mesma data, mês passado)",
  };
  return `${sign}${formatNumber(p, 2)}%${ref} · ${leg[kind]}`;
}

export function ResumoDiarioHub() {
  const [data, setData] = useState<ResumoDiario | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await safeFetchJson<ResumoDiario>("/api/dash/resumo-diario");
      if (cancel) return;
      if (!r.ok) {
        setErr(r.error);
        setData(null);
        return;
      }
      setErr(null);
      setData(r.data);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const s = data?.saldo_bancario;
  const p = data?.contas_pagar_baixas;
  const rec = data?.contas_receber_baixas;
  const v = data?.vendas_liquido;
  const t = data?.totais_fluxo;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Resumo do dia
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Indicadores na data{" "}
          <span className="text-zinc-300 font-medium">
            {data?.data_referencia ?? "—"}
          </span>
          : saldo bancário (cadastro), baixas de contas a pagar/receber e vendas
          NF finalizadas. Fluxo líquido = recebimentos − pagamentos (sem vendas).
          Comparativos: mesmo dia no mês anterior, ou MTD (1.º do mês até hoje vs 1.º
          a mesma data no mês passado). No cartão “calendário — CLIPP” o valor
          principal é o mês corrente completo; a % e o ref. usam essa mesma base
          MTD homólogo do mês passado.
          Quando aparece <span className="text-zinc-500">n/d</span>, a base de
          comparação no mês passado é &lt; R$ 1 ou inexistente. No fluxo, se o
          mês passado tiver sinal oposto ao atual, a % usa o valor absoluto do
          mês passado no denominador (variação em relação à magnitude da saída
          anterior).
        </p>
      </div>

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">Saldo bancário e cartões</h2>
        <p className="text-[11px] text-zinc-500 -mt-1 max-w-2xl">
          A conta SIPAG (adquirente,{" "}
          <code className="text-zinc-500">ID_CONTA=6</code>) não entra no total de
          bancos; aparece em cartões a receber.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
          <KpiCard
            label="Saldo disponível (bancos / caixa)"
            value={formatBRL(s?.disponivel)}
            variant="accent"
            hint={`${formatInt(Number(s?.qtd_contas ?? 0))} contas (cadastro; exclusões e SIPAG na API)`}
          />
          <KpiCard
            label="Saldo cartões a receber (SIPAG)"
            value={formatBRL(s?.cartoes_receber?.disponivel)}
            variant="accent"
            hint={`${formatInt(Number(s?.cartoes_receber?.qtd_contas ?? 0))} conta(s)`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Contas a pagar (baixas / pagamentos)
        </h2>
        <p className="text-[11px] text-zinc-500 -mt-1">
          <span className="text-zinc-400">Pago hoje</span> e comparativo do mesmo dia
          no mês anterior: só{" "}
          <code className="text-zinc-500">TIP_PAGTO = &apos;T&apos;</code>, como
          «Pagas» no Resumo do dia no CLIPP. Totais do mês (até hoje, calendário e %
          MTD):{" "}
          <code className="text-zinc-500">TIP_PAGTO IN (&apos;T&apos;,&apos;P&apos;)</code>
          , como a barra «Pagas» no Resumo do Mês. O cartão calendário soma o mês
          corrente (incl. datas futuras); % e ref. comparam com 1.º a mesma data do
          mês passado.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Pago hoje"
            value={formatBRL(p?.hoje)}
            hint={momPct(p?.pct_mom_hoje, "dia", p?.hoje_mes_passado)}
          />
          <KpiCard
            label="Pago no mês (até hoje)"
            value={formatBRL(p?.mtd)}
            hint={momPct(p?.pct_mom_mtd, "mtd", p?.mtd_mes_passado)}
          />
          <KpiCard
            label="Pago no mês (calendário — CLIPP)"
            value={formatBRL(p?.mes_calendario)}
            hint={momPct(
              p?.pct_mom_mes_calendario,
              "cal",
              p?.mes_calendario_mes_passado,
            )}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Contas a receber (baixas / recebimentos)
        </h2>
        <p className="text-[11px] text-zinc-500 -mt-1">
          Soma de <code className="text-zinc-500">VLR_RECEB</code> por{" "}
          <code className="text-zinc-500">DT_BAIXA</code> (uma linha por baixa). O{" "}
          <span className="text-zinc-400">ref.</span> na variação % é esse total no
          período homólogo (mesmo dia ou MTD).{" "}
          <span className="text-zinc-400">
            Não confundir com o rodapé “Vlr. Recebido” de um HTML/relatório de
            posição de títulos
          </span>
          : lá costuma ser a soma do valor já recebido <em>em cada título</em> em
          todas as linhas (acumulado por título), não a soma das baixas só no
          intervalo de datas do comparativo. No cartão calendário, o ref. do % é o
          mesmo critério do cartão “até hoje” (ex.: 01/03–23/03 se hoje for
          23/04).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Recebido hoje"
            value={formatBRL(rec?.hoje)}
            hint={momPct(rec?.pct_mom_hoje, "dia", rec?.hoje_mes_passado)}
            variant="accent"
          />
          <KpiCard
            label="Recebido no mês (até hoje)"
            value={formatBRL(rec?.mtd)}
            hint={momPct(rec?.pct_mom_mtd, "mtd", rec?.mtd_mes_passado)}
            variant="accent"
          />
          <KpiCard
            label="Recebido no mês (calendário — CLIPP)"
            value={formatBRL(rec?.mes_calendario)}
            hint={momPct(
              rec?.pct_mom_mes_calendario,
              "cal",
              rec?.mes_calendario_mes_passado,
            )}
            variant="accent"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">Vendas (NF finalizada)</h2>
        <p className="text-[11px] text-zinc-500 -mt-1">
          Por <code className="text-zinc-500">DT_SAIDA</code>: soma dos{" "}
          <code className="text-zinc-500">VLR_PAGTO</code> em{" "}
          <code className="text-zinc-500">V_NFVENDA_PAGAMENTOS</code> por NF, ou
          se a NF não tiver linhas nessa view, o total{" "}
          <code className="text-zinc-500">VLR_TOTALNOTAJUROS</code> da nota. O
          cartão <span className="text-zinc-400">mês calendário</span> cobre o mês
          corrente (incl. NF com saída futura); a % e o ref. usam o MTD homólogo do
          mês passado, como no cartão “até hoje”.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Vendas hoje"
            value={formatBRL(v?.hoje)}
            hint={momPct(v?.pct_mom_hoje, "dia", v?.hoje_mes_passado)}
          />
          <KpiCard
            label="Vendas no mês (até hoje)"
            value={formatBRL(v?.mtd)}
            hint={momPct(v?.pct_mom_mtd, "mtd", v?.mtd_mes_passado)}
          />
          <KpiCard
            label="Vendas no mês (calendário — CLIPP)"
            value={formatBRL(v?.mes_calendario)}
            hint={momPct(
              v?.pct_mom_mes_calendario,
              "cal",
              v?.mes_calendario_mes_passado,
            )}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">Total fluxo</h2>
        <p className="text-xs text-zinc-500 max-w-2xl">
          {t?.formula ??
            "recebimentos (baixas a receber) − pagamentos (dia e MTD), sem vendas."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Fluxo líquido hoje"
            value={formatBRL(t?.hoje)}
            hint={momPct(t?.pct_mom_hoje, "fluxDia", t?.hoje_mes_passado)}
            variant="warn"
          />
          <KpiCard
            label="Fluxo líquido no mês (até hoje)"
            value={formatBRL(t?.mtd)}
            hint={momPct(t?.pct_mom_mtd, "fluxMtd", t?.mtd_mes_passado)}
            variant="warn"
          />
        </div>
      </section>
    </div>
  );
}
