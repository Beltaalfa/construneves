import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function TableWrap({ children, className = "" }: Props) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30 ${className}`}
    >
      {children}
    </div>
  );
}

type SimpleRow = Record<string, string | number | boolean | null | undefined>;

export function SimpleTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: SimpleRow[];
}) {
  return (
    <TableWrap>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700/50">
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left font-medium text-zinc-400 px-4 py-3"
              >
                {c.label}
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
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 text-zinc-200">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
