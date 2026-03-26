"use client";

import { formatBRL } from "@/lib/format";
import { useCallback, useMemo, useState } from "react";

const MESES_PT = [
  "",
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

type Raw = Record<string, unknown>;

function n(v: unknown): number {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function parseDay(s: unknown): Date {
  const d = new Date(String(s ?? "").slice(0, 10));
  if (Number.isNaN(d.getTime())) return new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startMonday(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endSunday(monday: Date): Date {
  const e = new Date(monday);
  e.setDate(e.getDate() + 6);
  e.setHours(0, 0, 0, 0);
  return e;
}

type Urgency = "vencido" | "semana" | "normal";

function urgencyOf(dtVenc: Date, hoje: Date): Urgency {
  const v = new Date(dtVenc);
  v.setHours(0, 0, 0, 0);
  const t = new Date(hoje);
  t.setHours(0, 0, 0, 0);
  if (v < t) return "vencido";
  const mon = startMonday(t);
  const sun = endSunday(mon);
  if (v >= t && v <= sun) return "semana";
  return "normal";
}

function worst(a: Urgency, b: Urgency): Urgency {
  const r: Record<Urgency, number> = { vencido: 3, semana: 2, normal: 1 };
  return r[a] >= r[b] ? a : b;
}

function semanaLabel(sn: number): string {
  const m: Record<number, string> = {
    1: "Semana 1 (dias 1–7)",
    2: "Semana 2 (dias 8–14)",
    3: "Semana 3 (dias 15–21)",
    4: "Semana 4 (dias 22–28)",
    5: "Semana 5 (dias 29–fim)",
  };
  return m[sn] ?? `Semana ${sn}`;
}

interface MatrixNode {
  key: string;
  label: string;
  depth: number;
  tipo: "mes" | "semana" | "dia" | "fornecedor" | "titulo";
  totals: { vt: number; saldo: number; av: number };
  urgency: Urgency;
  children?: MatrixNode[];
  dtVenc?: string;
}

type TotAgg = { vt: number; saldo: number; av: number };

const ZERO: TotAgg = { vt: 0, saldo: 0, av: 0 };

function sumRows(rows: Raw[]): TotAgg {
  return rows.reduce<TotAgg>(
    (s, r) => ({
      vt: s.vt + n(r.VALOR_TITULO),
      saldo: s.saldo + n(r.SALDO_ABERTO),
      av: s.av + n(r.VALOR_A_VENCER),
    }),
    { ...ZERO },
  );
}

function groupBy(rows: Raw[], fn: (r: Raw) => string): Map<string, Raw[]> {
  const m = new Map<string, Raw[]>();
  for (const r of rows) {
    const k = fn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function rollupUrgency(rows: Raw[], hoje: Date): Urgency {
  return rows.reduce(
    (u, r) => worst(u, urgencyOf(parseDay(r.DT_VENCTO), hoje)),
    "normal" as Urgency,
  );
}

function buildTree(rows: Raw[], hoje: Date): MatrixNode[] {
  const byYM = groupBy(rows, (r) => `${n(r.ANO)}-${n(r.MES_NUM)}`);
  const keysYM = Array.from(byYM.keys()).sort((a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return ya - yb || ma - mb;
  });

  return keysYM.map((ym): MatrixNode => {
    const chunk = byYM.get(ym)!;
    const [ya, ma] = ym.split("-").map(Number);
    const labelMes = `${MESES_PT[ma] ?? ma} ${ya}`;

    const bySem = groupBy(chunk, (r) => String(n(r.SEMANA_MES)));
    const semKeys = Array.from(bySem.keys()).sort((a, b) => n(a) - n(b));

    const semNodes: MatrixNode[] = semKeys.map((sk) => {
      const chS = bySem.get(sk)!;
      const byDia = groupBy(chS, (r) => String(n(r.DIA_MES)));
      const diaKeys = Array.from(byDia.keys()).sort((a, b) => n(a) - n(b));

      const diaNodes: MatrixNode[] = diaKeys.map((dk) => {
        const chD = byDia.get(dk)!;
        const byF = groupBy(chD, (r) => String(n(r.ID_FORNEC)));
        const fKeys = Array.from(byF.keys()).sort((a, b) => n(a) - n(b));

        const fornNodes: MatrixNode[] = fKeys.map((fk) => {
          const chF = byF.get(fk)!;
          const nomeF = String(chF[0]?.FORNECEDOR ?? fk).slice(0, 72);
          const titulos: MatrixNode[] = chF
            .map((r) => {
              const dt = parseDay(r.DT_VENCTO);
              const u = urgencyOf(dt, hoje);
              return {
                key: `t-${n(r.ID_CTAPAG)}`,
                label: String(r.DOCUMENTO ?? "—"),
                depth: 4,
                tipo: "titulo" as const,
                totals: {
                  vt: n(r.VALOR_TITULO),
                  saldo: n(r.SALDO_ABERTO),
                  av: n(r.VALOR_A_VENCER),
                },
                urgency: u,
                dtVenc: String(r.DT_VENCTO ?? "").slice(0, 10),
              };
            })
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

          const tFor = sumRows(chF);

          return {
            key: `${ym}-${sk}-${dk}-f${fk}`,
            label: nomeF,
            depth: 3,
            tipo: "fornecedor" as const,
            totals: tFor,
            urgency: rollupUrgency(chF, hoje),
            children: titulos,
          };
        });

        const tDia = sumRows(chD);

        return {
          key: `${ym}-${sk}-d${dk}`,
          label: `Dia ${dk}`,
          depth: 2,
          tipo: "dia" as const,
          totals: tDia,
          urgency: rollupUrgency(chD, hoje),
          children: fornNodes,
        };
      });

      const tSem = sumRows(chS);

      return {
        key: `${ym}-s${sk}`,
        label: semanaLabel(n(sk)),
        depth: 1,
        tipo: "semana" as const,
        totals: tSem,
        urgency: rollupUrgency(chS, hoje),
        children: diaNodes,
      };
    });

    const tMes = sumRows(chunk);

    return {
      key: ym,
      label: labelMes,
      depth: 0,
      tipo: "mes" as const,
      totals: tMes,
      urgency: rollupUrgency(chunk, hoje),
      children: semNodes,
    };
  });
}

function rowTone(u: Urgency): string {
  if (u === "vencido")
    return "bg-rose-950/50 border-l-[3px] border-rose-500";
  if (u === "semana")
    return "bg-amber-950/40 border-l-[3px] border-amber-500";
  return "bg-zinc-900/20 border-l-[3px] border-zinc-700/40";
}

function MatrixRow({
  node,
  expanded,
  toggle,
}: {
  node: MatrixNode;
  expanded: Set<string>;
  toggle: (k: string) => void;
}) {
  const hasKids = Boolean(node.children?.length);
  const open = expanded.has(node.key);
  const pad = 10 + node.depth * 14;
  const isTitulo = node.tipo === "titulo";

  return (
    <>
      <tr className={`border-b border-zinc-800/70 ${rowTone(node.urgency)}`}>
        <td className="py-2 pr-2 align-middle" style={{ paddingLeft: pad }}>
          <div className="flex items-center gap-1.5 min-w-0">
            {hasKids ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(node.key)}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-zinc-600/80 text-zinc-200 text-sm hover:bg-zinc-800/80"
              >
                {open ? "−" : "+"}
              </button>
            ) : (
              <span className="w-7 shrink-0 inline-block" />
            )}
            <span
              className={`truncate ${node.depth === 0 ? "font-semibold text-zinc-100" : isTitulo ? "text-zinc-300 font-mono text-[11px]" : "text-zinc-200"}`}
              title={node.label}
            >
              {node.label}
            </span>
            {isTitulo && node.dtVenc ? (
              <span className="text-[10px] text-zinc-500 shrink-0 ml-1">
                venc. {node.dtVenc}
              </span>
            ) : null}
          </div>
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-zinc-200 whitespace-nowrap">
          {formatBRL(node.totals.vt)}
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-zinc-200 whitespace-nowrap">
          {formatBRL(node.totals.saldo)}
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-zinc-200 whitespace-nowrap">
          {formatBRL(node.totals.av)}
        </td>
        <td className="py-2 px-2 text-xs text-zinc-500 whitespace-nowrap">
          Em aberto
        </td>
      </tr>
      {hasKids && open
        ? node.children!.map((ch) => (
            <MatrixRow
              key={ch.key}
              node={ch}
              expanded={expanded}
              toggle={toggle}
            />
          ))
        : null}
    </>
  );
}

export function ContasPagarMatrixHierarquia({
  rows,
}: {
  rows: Raw[];
}) {
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tree = useMemo(() => buildTree(rows, hoje), [rows, hoje]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const walk = (nodes: MatrixNode[]) => {
      for (const n of nodes) {
        if (n.children?.length) all.add(n.key);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    setExpanded(all);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const grand = useMemo(() => sumRows(rows), [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-950/40 p-6">
        <h3 className="text-sm font-semibold text-zinc-100">
          Matriz por vencimento
        </h3>
        <p className="text-xs text-zinc-500 mt-2">Sem títulos em aberto.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-b from-zinc-900/45 to-zinc-950/90 shadow-lg shadow-black/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800/80 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Matriz por vencimento (cascata)
          </h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-3xl leading-relaxed">
            Mês → semana do calendário (blocos 1–7, 8–14…) → dia → fornecedor →
            número do título.{" "}
            <span className="text-rose-400/90">Vermelho</span>: vencido.{" "}
            <span className="text-amber-400/90">Laranja</span>: vence na
            semana corrente (segunda a domingo). Urgência do grupo = pior caso
            entre os filhos.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-300 hover:bg-zinc-800/70"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-600/80 text-zinc-300 hover:bg-zinc-800/70"
          >
            Recolher
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[min(75vh,720px)] overflow-y-auto">
        <table className="w-full text-xs min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-zinc-950/98 backdrop-blur-sm border-b border-zinc-700/60">
            <tr>
              <th className="text-left font-semibold text-zinc-500 uppercase tracking-wider py-2.5 pl-3 pr-2">
                Hierarquia
              </th>
              <th className="text-right font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2.5 whitespace-nowrap">
                Valor título
              </th>
              <th className="text-right font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2.5 whitespace-nowrap">
                Saldo aberto
              </th>
              <th className="text-right font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2.5 whitespace-nowrap">
                A vencer
              </th>
              <th className="text-left font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2.5 whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tree.map((n) => (
              <MatrixRow
                key={n.key}
                node={n}
                expanded={expanded}
                toggle={toggle}
              />
            ))}
            <tr className="bg-zinc-950/80 border-t-2 border-zinc-600 font-semibold text-zinc-100">
              <td className="py-2.5 pl-3">Total</td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                {formatBRL(grand.vt)}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                {formatBRL(grand.saldo)}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                {formatBRL(grand.av)}
              </td>
              <td className="py-2.5 px-2 text-zinc-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-zinc-600 px-4 py-2 border-t border-zinc-800/60">
        Até 2500 linhas na API. Semana do mês = dias 1–7, 8–14, 15–21, 22–28,
        29–fim (alinhado ao Power BI por dia do mês).
      </p>
    </div>
  );
}
