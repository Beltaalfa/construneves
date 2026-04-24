import Link from "next/link";
import { internalFetch } from "@/lib/internal-api";

export default async function HomePage() {
  let health: { ok?: boolean; firebird?: boolean; error?: string } = {};
  try {
    const res = await internalFetch("/health");
    const bodyText = await res.text();
    if (!res.ok) {
      health = {
        ok: false,
        firebird: false,
        error: `A API Python respondeu HTTP ${res.status}. ${bodyText.slice(0, 240)}`,
      };
    } else {
      try {
        health = JSON.parse(bodyText) as typeof health;
      } catch {
        health = {
          ok: false,
          firebird: false,
          error: "Resposta inválida de /health (não é JSON).",
        };
      }
    }
  } catch (e) {
    const hint =
      process.env.PAINEL_INTERNAL_API?.trim() || "http://127.0.0.1:8091";
    const detail = e instanceof Error ? e.message : String(e);
    health = {
      ok: false,
      firebird: false,
      error: `Não foi possível ligar à painel-api em ${hint}. (${detail}) Confirme que o serviço está ativo (ex.: systemctl status construneves-painel-api) e que PAINEL_INTERNAL_API no .env aponta para o host/porta corretos.`,
    };
  }

  const ok = health.firebird === true;

  const dashLinks = [
    { href: "/dashboard/resumo-diario", label: "Resumo do dia" },
    { href: "/dashboard/contas-a-pagar", label: "Contas a pagar" },
    { href: "/dashboard/contas-a-receber", label: "Contas a receber" },
    {
      href: "/dashboard/financeiro/contas-bancarias-saldos",
      label: "Saldos em contas (hoje)",
    },
    { href: "/dashboard/estoque-e-compras", label: "Estoque e compras" },
    { href: "/dashboard/estoque/pedidos-compra", label: "Pedidos de compra" },
    { href: "/cobranca/apontamentos", label: "Apontamentos de cobrança" },
    { href: "/dashboard/vendas", label: "Vendas" },
    { href: "/dashboard/precos/markup-validacao", label: "Conferir mark-up" },
  ];

  return (
    <div className="space-y-8 w-full min-w-0 max-w-full lg:max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Painel Construneves
        </h1>
        <p className="text-zinc-400 mt-2 text-sm max-w-xl">
          Indicadores e relatórios a partir do seu sistema. A ligação ao banco depende da rede até ao servidor de dados.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Ligação aos dados</h2>
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
