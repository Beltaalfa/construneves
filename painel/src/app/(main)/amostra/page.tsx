import Link from "next/link";
import { SimpleTable } from "@/components/ui/Table";
import { internalFetch } from "@/lib/internal-api";

type Row = { TABLE_NAME?: string; TABELA?: string };

export default async function AmostraPage() {
  let rows: Row[] = [];
  let err: string | null = null;
  try {
    const res = await internalFetch("/sample/tables?limit=40");
    const data = await res.json();
    if (!res.ok) {
      err = (data as { detail?: string }).detail || JSON.stringify(data);
    } else {
      rows = (data as { rows?: Row[] }).rows || [];
    }
  } catch (e) {
    err = String(e);
  }

  const normalized = rows.map((r) => ({
    TABLE_NAME: String(r.TABLE_NAME ?? r.TABELA ?? "—"),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Nomes técnicos (amostra)
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-md">
            Nomes de tabelas no banco (apoio técnico à estrutura de dados).
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          Voltar ao início
        </Link>
      </div>

      {err ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {err}
        </div>
      ) : (
        <SimpleTable
          columns={[{ key: "TABLE_NAME", label: "Tabela" }]}
          rows={normalized}
        />
      )}
    </div>
  );
}
