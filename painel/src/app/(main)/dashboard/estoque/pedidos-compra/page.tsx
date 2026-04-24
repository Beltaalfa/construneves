import { internalFetch } from "@/lib/internal-api";
import PedidosCompraClient from "./PedidosCompraClient";

type Payload = {
  count?: number;
  ordens_abertas?: number;
  rows?: Record<string, unknown>[];
};

export default async function PedidosCompraPage() {
  let payload: Payload = {};
  let err: string | null = null;
  try {
    const res = await internalFetch("/dash/estoque/pedidos-compra");
    if (!res.ok) err = await res.text();
    else payload = await res.json();
  } catch (e) {
    err = String(e);
  }

  return (
    <div className="relative min-h-0 space-y-10 pb-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.07),transparent_55%)] opacity-90"
      />
      <header className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-950 px-4 py-6 sm:px-8 sm:py-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-500/90">
          Estoque / Compras
        </p>
        <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight sm:text-3xl">
          Pedidos de compra abertos
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-full lg:max-w-3xl">
          Ordens abertas (não finalizadas/canceladas).{" "}
          <span className="text-zinc-300">Sugestão</span>:{" "}
          <code className="text-zinc-500">max(qtd_minim − qtd_atual, 0)</code> no cadastro.{" "}
          <span className="text-zinc-300">Último custo / qtd. última compra</span>: última NF de entrada (MT).
        </p>
      </header>

      {err ? (
        <div className="relative rounded-xl border border-red-500/25 bg-red-950/30 px-5 py-4 text-red-300 text-sm">
          {err}
        </div>
      ) : null}

      <PedidosCompraClient
        initialRows={payload.rows ?? []}
        initialCount={Number(payload.count ?? 0)}
        initialOrdens={Number(payload.ordens_abertas ?? 0)}
      />
    </div>
  );
}
