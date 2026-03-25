import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { formatBRL, formatNumber } from "@/lib/format";

export type MarkupRow = {
  COD_PRODUTO?: number;
  PRODUTO?: string;
  CUSTO?: number;
  VENDA?: number;
  DIF_MARKUP_PCT?: number;
  MARKUP_SISTEMA_PCT?: number;
  MARKUP_CALCULADO_PCT?: number;
  MARGEM_BRUTA_PCT?: number;
  VALIDACAO?: string;
};

export type MarkupSortKey =
  | "COD_PRODUTO"
  | "PRODUTO"
  | "CUSTO"
  | "VENDA"
  | "DIF_MARKUP_PCT"
  | "MARKUP_SISTEMA_PCT"
  | "MARKUP_CALCULADO_PCT"
  | "MARGEM_BRUTA_PCT"
  | "VALIDACAO";

function badgeClass(v: string) {
  if (v === "DIVERGENTE")
    return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  if (v === "SEM CUSTO")
    return "bg-zinc-600/30 text-zinc-300 border-zinc-500/30";
  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
}

type SortState = { key: MarkupSortKey; dir: "asc" | "desc" };

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) {
    return (
      <span className="inline-flex flex-col text-zinc-600 scale-75">
        <IconChevronUp size={12} strokeWidth={2} />
        <IconChevronDown size={12} strokeWidth={2} className="-mt-2" />
      </span>
    );
  }
  return dir === "asc" ? (
    <IconChevronUp size={16} strokeWidth={2} className="text-blue-400" />
  ) : (
    <IconChevronDown size={16} strokeWidth={2} className="text-blue-400" />
  );
}

function Th({
  label,
  sortKey,
  align,
  current,
  onSort,
}: {
  label: string;
  sortKey: MarkupSortKey;
  align: "left" | "right";
  current: SortState | null;
  onSort: (k: MarkupSortKey) => void;
}) {
  const active = current?.key === sortKey;
  return (
    <th className={`${align === "right" ? "text-right" : "text-left"} px-3 py-3`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap select-none rounded-lg px-1 -mx-1 py-0.5 hover:bg-zinc-800/80 transition-colors ${
          active ? "text-zinc-200" : "text-zinc-400"
        } ${align === "right" ? "flex-row-reverse ml-auto" : ""}`}
      >
        {label}
        <SortIcon active={active} dir={active ? current!.dir : "asc"} />
      </button>
    </th>
  );
}

export function ValidationMarkupTable({
  rows,
  sort,
  onSort,
}: {
  rows: MarkupRow[];
  sort: SortState;
  onSort: (k: MarkupSortKey) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500 py-8 text-center">
        Nenhum produto com os filtros atuais
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
      <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800">
            <tr>
              <Th
                label="Cod. produto"
                sortKey="COD_PRODUTO"
                align="left"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Produto"
                sortKey="PRODUTO"
                align="left"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Custo"
                sortKey="CUSTO"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Venda"
                sortKey="VENDA"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Dif MarkUP %"
                sortKey="DIF_MARKUP_PCT"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="MarkUP sistema %"
                sortKey="MARKUP_SISTEMA_PCT"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="MarkUP calc. %"
                sortKey="MARKUP_CALCULADO_PCT"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Margem bruta %"
                sortKey="MARGEM_BRUTA_PCT"
                align="right"
                current={sort}
                onSort={onSort}
              />
              <Th
                label="Validação"
                sortKey="VALIDACAO"
                align="left"
                current={sort}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = String(r.VALIDACAO ?? "—");
              const stripe = i % 2 === 0 ? "bg-zinc-900/20" : "bg-zinc-900/45";
              return (
                <tr
                  key={`${r.COD_PRODUTO}-${i}`}
                  className={`border-b border-zinc-800/80 hover:bg-zinc-800/35 ${stripe}`}
                >
                  <td className="px-3 py-2 text-zinc-300 tabular-nums">
                    {r.COD_PRODUTO ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-zinc-200 text-left max-w-[320px] truncate"
                    title={r.PRODUTO}
                  >
                    {r.PRODUTO ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-200 tabular-nums">
                    {formatBRL(r.CUSTO)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-200 tabular-nums">
                    {formatBRL(r.VENDA)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                    {formatNumber(r.DIF_MARKUP_PCT, 2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                    {formatNumber(r.MARKUP_SISTEMA_PCT, 2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                    {formatNumber(r.MARKUP_CALCULADO_PCT, 2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                    {formatNumber(r.MARGEM_BRUTA_PCT, 2)}%
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase border ${badgeClass(v)}`}
                    >
                      {v}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500 px-3 py-2 border-t border-zinc-800">
        {rows.length} linha(s) exibida(s)
      </p>
    </div>
  );
}
