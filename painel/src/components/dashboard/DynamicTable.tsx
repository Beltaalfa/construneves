import { TableExportXlsxButton } from "@/components/dashboard/TableExportXlsxButton";
import { formatInt } from "@/lib/format";
import { formatDashboardCell } from "@/lib/table-cell-format";

type Row = Record<string, unknown>;

export function DynamicTable({
  rows,
  columns,
  title,
  maxHeightClass = "max-h-[420px]",
  exportFileName,
}: {
  rows: Row[];
  columns?: string[];
  title?: string;
  maxHeightClass?: string;
  /** Se definido, mostra botão de exportação XLSX com estas colunas. */
  exportFileName?: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-zinc-500 py-6 text-center">
        Nenhum registro
      </p>
    );
  }

  const keys =
    columns ??
    Object.keys(rows[0]).filter((k) => !k.startsWith("_")).slice(0, 14);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden flex flex-col">
      {title || exportFileName ? (
        <div
          className={`px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-2 ${
            exportFileName ? "justify-between" : ""
          }`}
        >
          {title ? (
            <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
          ) : null}
          {exportFileName ? (
            <TableExportXlsxButton
              rows={rows as Record<string, unknown>[]}
              columnKeys={keys}
              fileNameBase={exportFileName}
            />
          ) : null}
        </div>
      ) : null}
      <div className={`overflow-auto ${maxHeightClass}`}>
        <table className="w-full text-xs sm:text-sm min-w-[640px]">
          <thead className="sticky top-0 bg-zinc-950/95 z-10 backdrop-blur-sm">
            <tr className="border-b border-zinc-700/50">
              {keys.map((k) => (
                <th
                  key={k}
                  className="text-left font-medium text-zinc-400 px-3 py-2.5 whitespace-nowrap"
                >
                  {k.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-700/30 hover:bg-zinc-800/30"
              >
                {keys.map((k) => (
                  <td
                    key={k}
                    className="px-3 py-2 text-zinc-200 whitespace-nowrap max-w-[220px] truncate"
                    title={String(row[k] ?? "")}
                  >
                    {formatDashboardCell(k, row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500 px-3 py-2 border-t border-zinc-800">
        {formatInt(rows.length)} linha(s) — colunas limitadas para leitura
      </p>
    </div>
  );
}
