"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ValidationMarkupTable,
  type MarkupRow,
  type MarkupSortKey,
} from "@/components/dashboard/ValidationMarkupTable";
import { TableExportXlsxButton } from "@/components/dashboard/TableExportXlsxButton";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatInt, formatNumber } from "@/lib/format";

export type ValidacaoPreset =
  | "ALL"
  | "OK"
  | "DIVERGENTE"
  | "SEM CUSTO"
  | "MARKUP_LT_40";

const MARKUP_XLSX_COLS = [
  "COD_PRODUTO",
  "PRODUTO",
  "CUSTO",
  "VENDA",
  "DIF_MARKUP_PCT",
  "MARKUP_SISTEMA_PCT",
  "MARKUP_CALCULADO_PCT",
  "MARGEM_BRUTA_PCT",
  "VALIDACAO",
] as const;

type Stats = {
  total_produtos?: number;
  divergentes?: number;
  ok?: number;
  sem_custo?: number;
  pct_divergentes?: number;
  margem_bruta_media_divergentes?: number;
  produtos_margem_bruta_menor_10?: number;
  maior_dif_markup_abs_pp?: number;
  produtos_markup_calc_menor_40?: number;
};

function tokenizeSearch(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
}

function rowMatchesSearch(row: MarkupRow, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const hay = (row.PRODUTO ?? "").toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

function rowMatchesPreset(row: MarkupRow, preset: ValidacaoPreset): boolean {
  const v = String(row.VALIDACAO ?? "");
  switch (preset) {
    case "ALL":
      return true;
    case "OK":
      return v === "OK";
    case "DIVERGENTE":
      return v === "DIVERGENTE";
    case "SEM CUSTO":
      return v === "SEM CUSTO";
    case "MARKUP_LT_40": {
      const cost = Number(row.CUSTO ?? 0);
      const m = row.MARKUP_CALCULADO_PCT;
      if (cost <= 0 || m == null) return false;
      return Number(m) < 40;
    }
    default:
      return true;
  }
}

type SortState = { key: MarkupSortKey; dir: "asc" | "desc" };

function compareRows(a: MarkupRow, b: MarkupRow, s: SortState): number {
  const mul = s.dir === "asc" ? 1 : -1;
  const key = s.key;
  const va = a[key];
  const vb = b[key];

  if (key === "PRODUTO" || key === "VALIDACAO") {
    return (
      mul *
      String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", {
        sensitivity: "base",
      })
    );
  }

  const na = Number(va);
  const nb = Number(vb);
  const aNa = Number.isNaN(na);
  const bNa = Number.isNaN(nb);
  if (aNa && bNa) return 0;
  if (aNa) return 1;
  if (bNa) return -1;
  return mul * (na - nb);
}

export function MarkupValidacaoClient({
  initialRows,
  stats,
  errorText,
}: {
  initialRows: MarkupRow[];
  stats: Stats;
  errorText: string | null;
}) {
  const [preset, setPreset] = useState<ValidacaoPreset>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({
    key: "DIF_MARKUP_PCT",
    dir: "desc",
  });

  const tokens = useMemo(() => tokenizeSearch(search), [search]);

  const onSort = useCallback((key: MarkupSortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }, []);

  const filteredSorted = useMemo(() => {
    let list = initialRows.filter(
      (r) => rowMatchesPreset(r, preset) && rowMatchesSearch(r, tokens),
    );
    list = [...list].sort((a, b) => compareRows(a, b, sort));
    return list;
  }, [initialRows, preset, tokens, sort]);

  const clearFilters = useCallback(() => {
    setPreset("ALL");
    setSearch("");
    setSort({ key: "DIF_MARKUP_PCT", dir: "desc" });
  }, []);

  const n = stats.total_produtos ?? initialRows.length;
  const hasActiveFilter =
    preset !== "ALL" || tokens.length > 0 || sort.key !== "DIF_MARKUP_PCT" || sort.dir !== "desc";

  return (
    <div className="space-y-6">
      {errorText ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorText}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
        <div className="flex-1 max-w-xl">
          <Input
            label="Buscar na descrição"
            placeholder="Ex.: abraçadeira 25 — palavras em qualquer ordem"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <TableExportXlsxButton
            rows={filteredSorted as Record<string, unknown>[]}
            columnKeys={[...MARKUP_XLSX_COLS]}
            fileNameBase="markup-validacao"
            disabled={!!errorText}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={clearFilters}
            disabled={!hasActiveFilter}
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total de produtos"
          value={formatInt(n)}
          variant="default"
          onClick={() => setPreset("ALL")}
          selected={preset === "ALL"}
        />
        <KpiCard
          label="Divergente"
          value={formatInt(stats.divergentes)}
          variant="warn"
          hint={`${formatNumber(stats.pct_divergentes, 2)}% do total`}
          onClick={() =>
            setPreset((p) => (p === "DIVERGENTE" ? "ALL" : "DIVERGENTE"))
          }
          selected={preset === "DIVERGENTE"}
        />
        <KpiCard
          label="Ok (bate com o cadastro)"
          value={formatInt(stats.ok)}
          variant="accent"
          onClick={() => setPreset((p) => (p === "OK" ? "ALL" : "OK"))}
          selected={preset === "OK"}
        />
        <KpiCard
          label="Sem custo"
          value={formatInt(stats.sem_custo)}
          hint="Preço de custo zero ou em branco"
          onClick={() =>
            setPreset((p) => (p === "SEM CUSTO" ? "ALL" : "SEM CUSTO"))
          }
          selected={preset === "SEM CUSTO"}
        />
        <KpiCard
          label="Mark-up recalculado abaixo de 40%"
          value={formatInt(stats.produtos_markup_calc_menor_40)}
          variant="danger"
          hint="Somente itens com custo informado"
          onClick={() =>
            setPreset((p) => (p === "MARKUP_LT_40" ? "ALL" : "MARKUP_LT_40"))
          }
          selected={preset === "MARKUP_LT_40"}
        />
        <KpiCard
          label="Margem bruta média (divergentes)"
          value={`${formatNumber(stats.margem_bruta_media_divergentes, 2)}%`}
        />
        <KpiCard
          label="Margem bruta abaixo de 10%"
          value={formatInt(stats.produtos_margem_bruta_menor_10)}
          variant="danger"
          hint="Com custo &gt; 0"
        />
        <KpiCard
          label="Maior diferença de mark-up (absoluta)"
          value={`${formatNumber(stats.maior_dif_markup_abs_pp, 2)} p.p.`}
        />
      </div>

      <p className="text-sm text-zinc-500">
        Mostrando{" "}
        <strong className="text-zinc-300">
          {filteredSorted.length.toLocaleString("pt-BR")}
        </strong>{" "}
        de{" "}
        <strong className="text-zinc-300">
          {initialRows.length.toLocaleString("pt-BR")}
        </strong>{" "}
        produtos
      </p>

      <ValidationMarkupTable rows={filteredSorted} sort={sort} onSort={onSort} />
    </div>
  );
}
