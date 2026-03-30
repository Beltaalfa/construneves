"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconLayoutDashboard,
  IconDatabase,
  IconMenu2,
  IconBuildingBank,
  IconX,
  IconCreditCard,
  IconReceipt,
  IconPackage,
  IconPercentage,
  IconShoppingCart,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useState } from "react";

const mainItems = [
  { href: "/", label: "Início", icon: IconLayoutDashboard },
  { href: "/amostra", label: "Amostra Firebird", icon: IconDatabase },
];

const financeItems = [
  {
    href: "/dashboard/contas-a-pagar",
    label: "Contas a pagar",
    icon: IconCreditCard,
  },
  {
    href: "/dashboard/contas-a-receber",
    label: "Contas a receber",
    icon: IconReceipt,
  },
  {
    href: "/dashboard/financeiro/contas-bancarias-saldos",
    label: "Saldos bancários",
    icon: IconBuildingBank,
  },
];

const estoqueItems = [
  {
    href: "/dashboard/estoque-e-compras",
    label: "Estoque e compras",
    icon: IconShoppingCart,
  },
  {
    href: "/dashboard/estoque-e-compras?tab=cobertura",
    label: "Giro e cobertura",
    icon: IconPackage,
  },
];

const vendasItems = [
  {
    href: "/dashboard/vendas",
    label: "Vendas",
    icon: IconTrendingUp,
  },
];

const precoItems = [
  {
    href: "/dashboard/precos/markup-validacao",
    label: "Validação MarkUP",
    icon: IconPercentage,
  },
];

function NavIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="[&>svg]:size-5 [&>svg]:stroke-[2] shrink-0">
      {children}
    </span>
  );
}

function navPathAndTab(href: string): { path: string; tab: string | null } {
  if (!href.includes("?")) return { path: href, tab: null };
  const [path, query] = href.split("?", 2);
  const tab = new URLSearchParams(query).get("tab");
  return { path, tab };
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
  pathname: string | null;
  onNavigate: () => void;
}) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const { path, tab: hrefTab } = navPathAndTab(href);

  let active = false;
  if (href === "/") {
    active = pathname === "/";
  } else if (hrefTab !== null) {
    active = pathname === path && currentTab === hrefTab;
  } else if (path === "/dashboard/estoque-e-compras") {
    active =
      pathname === path &&
      (currentTab === null || currentTab === "visao");
  } else {
    active =
      pathname === path || Boolean(pathname?.startsWith(`${path}/`));
  }
  const linkClass = active
    ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors bg-zinc-800 text-white"
    : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200";

  return (
    <Link href={href} className={linkClass} onClick={onNavigate}>
      <NavIcon>
        <Icon size={20} strokeWidth={2} />
      </NavIcon>
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <nav className="flex flex-col gap-4 p-3 pt-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-1">
        {mainItems.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
        ))}
      </div>
      <div>
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Financeiro
        </p>
        <div className="flex flex-col gap-1">
          {financeItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
        </div>
      </div>
      <div>
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Estoque
        </p>
        <div className="flex flex-col gap-1">
          {estoqueItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
        </div>
      </div>
      <div>
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Vendas
        </p>
        <div className="flex flex-col gap-1">
          {vendasItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
        </div>
      </div>
      <div>
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          Preços
        </p>
        <div className="flex flex-col gap-1">
          {precoItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <IconMenu2 size={22} strokeWidth={2} />
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 max-w-[85vw] flex flex-col border-r border-zinc-800 bg-black transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-14 lg:h-16 flex items-center justify-between px-3 border-b border-zinc-800 lg:border-b-0 shrink-0 pt-2 lg:pt-0">
          <span className="text-sm font-semibold text-zinc-100 pl-12 lg:pl-4">
            Construneves
          </span>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:bg-zinc-800"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          >
            <IconX size={20} strokeWidth={2} />
          </button>
        </div>
        {nav}
      </aside>
    </>
  );
}
