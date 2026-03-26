import * as XLSX from "xlsx";

/**
 * Exporta linhas para arquivo .xlsx (primeira aba "Dados").
 * Cabeçalhos = nomes de coluna com underscore trocado por espaço.
 */
export function downloadRowsAsXlsx(
  rows: Record<string, unknown>[],
  columnKeys: string[],
  fileNameBase: string,
): void {
  const safeName = fileNameBase.replace(/[/\\?%*:|"<>]/g, "-").trim() || "export";
  const headers = columnKeys.map((k) => k.replace(/_/g, " "));
  const body = rows.map((row) =>
    columnKeys.map((k) => {
      const v = row[k];
      if (v == null) return "";
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "boolean") return v ? "Sim" : "Não";
      return String(v);
    }),
  );
  const aoa = [headers, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}
