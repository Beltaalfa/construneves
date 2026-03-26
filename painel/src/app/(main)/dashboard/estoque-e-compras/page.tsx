import { EstoqueComprasHub } from "@/components/dashboard/EstoqueComprasHub";
import { Suspense } from "react";

export default function EstoqueEComprasPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-zinc-500 py-12 text-center">
          Carregando…
        </div>
      }
    >
      <EstoqueComprasHub />
    </Suspense>
  );
}
