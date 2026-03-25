import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function LayoutWithSidebar({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col lg:ml-64 w-full min-w-0">
        <header className="h-14 lg:h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-zinc-800/80" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto pt-16 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
