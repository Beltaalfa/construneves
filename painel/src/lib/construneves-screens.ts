/**
 * Ecrãs canónicos (ids = pathname + query opcional).
 * Manter alinhado com `north/hub/src/lib/construneves-screens.ts`.
 */
export type ConstrunevesScreenDef = { id: string; label: string };

export const CONSTRUNEVES_SCREENS: ConstrunevesScreenDef[] = [
  { id: "/", label: "Início" },
  { id: "/dashboard/resumo-diario", label: "Resumo do dia" },
  { id: "/dashboard/contas-a-pagar", label: "Contas a pagar" },
  { id: "/dashboard/contas-a-receber", label: "Contas a receber" },
  {
    id: "/dashboard/financeiro/contas-bancarias-saldos",
    label: "Saldos bancários",
  },
  { id: "/dashboard/estoque-e-compras", label: "Estoque e compras" },
  {
    id: "/dashboard/estoque-e-compras?tab=cobertura",
    label: "Giro e cobertura",
  },
  {
    id: "/dashboard/reconciliacao-ger-fiscal",
    label: "Conferir móvel e sistema",
  },
  {
    id: "/dashboard/estoque/pedidos-compra",
    label: "Pedidos de compra",
  },
  { id: "/dashboard/vendas", label: "Vendas" },
  {
    id: "/dashboard/precos/markup-validacao",
    label: "Conferir mark-up",
  },
  { id: "/cobranca/apontamentos", label: "Apontamentos de cobrança" },
  { id: "/permissoes", label: "Permissões" },
  { id: "/notificacoes", label: "Notificações (WhatsApp)" },
];

export const CONSTRUNEVES_SCREEN_IDS = new Set(CONSTRUNEVES_SCREENS.map((s) => s.id));

export const CONSTRUNEVES_API_PREFIX_TO_SCREEN: { prefix: string; screenId: string }[] = [
  { prefix: "/api/internal/cobranca-apontamentos", screenId: "/cobranca/apontamentos" },
  { prefix: "/api/internal/pedidos-compra-item", screenId: "/dashboard/estoque/pedidos-compra" },
  { prefix: "/api/internal/notificacoes-pedido-compra-negativos", screenId: "/notificacoes" },
  { prefix: "/api/internal/notificacoes-reenvio-negativo", screenId: "/notificacoes" },
  { prefix: "/api/internal/notificacoes", screenId: "/notificacoes" },
  { prefix: "/api/dash/resumo-diario", screenId: "/dashboard/resumo-diario" },
  { prefix: "/api/dash/contas-a-pagar", screenId: "/dashboard/contas-a-pagar" },
  { prefix: "/api/dash/contas-a-receber", screenId: "/dashboard/contas-a-receber" },
  {
    prefix: "/api/dash/financeiro/contas-bancarias-saldos",
    screenId: "/dashboard/financeiro/contas-bancarias-saldos",
  },
  { prefix: "/api/dash/estoque-e-compras", screenId: "/dashboard/estoque-e-compras" },
  {
    prefix: "/api/dash/reconciliacao-ger-fiscal",
    screenId: "/dashboard/reconciliacao-ger-fiscal",
  },
  {
    prefix: "/api/dash/estoque/pedidos-compra",
    screenId: "/dashboard/estoque/pedidos-compra",
  },
  { prefix: "/api/dash/vendas", screenId: "/dashboard/vendas" },
  {
    prefix: "/api/dash/precos/markup-validacao",
    screenId: "/dashboard/precos/markup-validacao",
  },
  { prefix: "/api/dash/", screenId: "/dashboard/estoque-e-compras" },
];

export function screenIdForApiPath(pathname: string): string | null {
  for (const { prefix, screenId } of CONSTRUNEVES_API_PREFIX_TO_SCREEN) {
    if (pathname.startsWith(prefix)) return screenId;
  }
  return null;
}

export function currentPageScreenId(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (pathname.startsWith("/api/")) return screenIdForApiPath(pathname);
  if (pathname === "/") return "/";
  if (pathname === "/permissoes") return "/permissoes";
  if (pathname === "/notificacoes") return "/notificacoes";
  if (pathname === "/cobranca/apontamentos") return "/cobranca/apontamentos";
  if (pathname === "/dashboard/estoque-e-compras" && searchParams.get("tab") === "cobertura") {
    return "/dashboard/estoque-e-compras?tab=cobertura";
  }
  return pathname;
}

/** Mapeia `href` do menu (pathname + query) para o id canónico em `construneves_screens`. */
export function navHrefToScreenId(href: string): string {
  const withoutHash = href.split("#")[0] || href;
  try {
    const u = new URL(
      withoutHash.startsWith("/") ? `https://construneves.invalid${withoutHash}` : withoutHash,
    );
    const id = currentPageScreenId(u.pathname, u.searchParams);
    return id ?? u.pathname;
  } catch {
    return "/";
  }
}

/** Quem pode ver o quê na sidebar (espelha `hubJwtAllowsPath` para rotas do menu). */
export type NavAccess =
  | { kind: "all" }
  | { kind: "minimal" }
  | { kind: "granular"; screens: string[] };

/**
 * Menu lateral: só entra o que está em `construneves_screens` (modo granular).
 * Início (`/`) e Permissões só aparecem se estiverem explicitamente na lista.
 * O middleware pode ainda permitir `/` e `/permissoes` por outras regras (evitar loops, refresh JWT).
 */
export function navItemAllowed(access: NavAccess, href: string): boolean {
  if (access.kind === "all") return true;
  const id = navHrefToScreenId(href);
  if (access.kind === "minimal") return false;
  return access.screens.includes(id);
}

export function hubJwtAllowsPath(
  decoded: Record<string, unknown>,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const role = decoded.hub_role;
  if (role === "admin") return true;
  /**
   * Início sempre permitido com JWT válido: senão um grant sem "/" gerava redirect "/" → "/" e
   * ERR_TOO_MANY_REDIRECTS (Neidson e outros com lista granular sem raiz).
   */
  if (pathname === "/") return true;
  /** Página de permissões (leitura) e refresh JWT — sempre acessível com sessão válida no painel. */
  if (pathname === "/permissoes" || pathname.startsWith("/api/auth/hub-refresh-jwt")) {
    return true;
  }
  const screens = decoded.construneves_screens;
  if (!Array.isArray(screens)) return true;
  if (screens.length === 0) {
    return pathname === "/permissoes" || pathname.startsWith("/api/hub/construneves-screen-grants");
  }
  const id = currentPageScreenId(pathname, searchParams);
  if (id == null) return true;
  if (!CONSTRUNEVES_SCREEN_IDS.has(id)) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/dash")) {
      return false;
    }
    return true;
  }
  return screens.includes(id);
}
