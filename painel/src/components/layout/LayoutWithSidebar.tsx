import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import type { NavAccess } from "@/lib/construneves-screens";
import { Sidebar } from "./Sidebar";

export function LayoutWithSidebar({
  children,
  navAccess,
}: {
  children: ReactNode;
  navAccess: NavAccess;
}) {
  return (
    <div className="min-h-screen min-h-dvh flex">
      <Suspense fallback={null}>
        <Sidebar navAccess={navAccess} />
      </Suspense>
      <div className="flex-1 min-h-screen min-h-dvh flex flex-col lg:ml-64 w-full min-w-0">
        <header className="flex min-h-14 shrink-0 items-center border-b border-zinc-800/80 py-2 pl-[3.15rem] pr-4 sm:min-h-16 sm:py-2.5 sm:pl-4 sm:pr-6 lg:min-h-[5.5rem] lg:py-3 lg:pl-6">
          <Link
            href="/"
            className="flex min-w-0 max-w-full items-center gap-3 sm:gap-4 py-0.5"
          >
            <img
              src="/logo-icone-nome-branco.svg"
              alt="North"
              className="h-[3.825rem] w-auto shrink-0 object-contain object-left sm:h-[4.675rem] lg:h-[5.1rem]"
              width={1080}
              height={1080}
              fetchPriority="high"
            />
            <span className="truncate text-lg font-medium tracking-tight text-zinc-200 sm:text-xl lg:text-2xl">
              Painel — Construneves
            </span>
          </Link>
        </header>
        <main className="flex-1 min-w-0 w-full overflow-x-auto overscroll-x-contain px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 lg:pt-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
      </div>
    </div>
  );
}
