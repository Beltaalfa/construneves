import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { internalFetch } from "@/lib/internal-api";

export default async function HomePage() {
  let health: { ok?: boolean; firebird?: boolean; error?: string } = {};
  try {
    const res = await internalFetch("/health");
    health = await res.json();
  } catch {
    health = { ok: false, firebird: false, error: "API indisponível" };
  }

  const ok = health.firebird === true;

  const dashLinks = [
    { href: "/dashboard/contas-a-pagar", label: "Contas a pagar" },
    { href: "/dashboard/contas-a-receber", label: "Contas a receber" },
    { href: "/dashboard/estoque/giro", label: "Estoque — giro" },
    { href: "/dashboard/estoque/bcg", label: "Estoque — BCG" },
    { href: "/dashboard/precos/markup-validacao", label: "Validação MarkUP" },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Painel Construneves
        </h1>
        <p className="text-zinc-400 mt-2">
          Conexão CLIPP via Firebird (VPN). Dashboards a partir das queries em{" "}
          <code className="text-zinc-500">/var/www/construneves/*.sql</code>,
          visual dark alinhado ao guia Hub.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Status Firebird</h2>
        <p className="text-zinc-200">
          {ok ? (
            <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Conectado
            </span>
          ) : (
            <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              Erro
            </span>
          )}
        </p>
        {!ok && health.error ? (
          <p className="text-sm text-red-400/90">{health.error}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link href="/amostra">
            <Button variant="secondary">Tabelas (amostra)</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/20 p-5">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Dashboards</h2>
        <ul className="grid sm:grid-cols-2 gap-2">
          {dashLinks.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors"
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
