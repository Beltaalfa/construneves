import { VendasHub } from "@/components/dashboard/VendasHub";
import { Suspense } from "react";

export default function VendasPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-zinc-500 py-12 text-center">
          Carregando…
        </div>
      }
    >
      <VendasHub />
    </Suspense>
  );
}
