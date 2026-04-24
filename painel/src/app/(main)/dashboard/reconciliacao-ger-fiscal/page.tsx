import { Suspense } from "react";
import { ReconciliacaoGerFiscalClient } from "./ReconciliacaoGerFiscalClient";

function Fallback() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-6 text-sm text-zinc-500">
      A carregar reconciliação…
    </div>
  );
}

export default function ReconciliacaoGerFiscalPage() {
  return (
    <div className="relative min-h-0 space-y-10 pb-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_90%_50%_at_50%_-20%,rgba(6,182,212,0.08),transparent_60%)] opacity-90"
      />
      <header className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-950 px-4 py-6 sm:px-8 sm:py-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/90">
          Estoque / Compras
        </p>
        <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight sm:text-3xl">
          Conferir móvel e sistema
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-full sm:max-w-2xl">
          Mês a mês: <span className="text-zinc-200 font-medium">móvel (caminhão)</span> vs.{" "}
          <span className="text-zinc-200 font-medium">escritório</span> (compras e vendas). Diferenças de arredondamento são marcadas; atenção se só um lado move e ainda há estoque.
        </p>
      </header>
      <Suspense fallback={<Fallback />}>
        <ReconciliacaoGerFiscalClient />
      </Suspense>
    </div>
  );
}
