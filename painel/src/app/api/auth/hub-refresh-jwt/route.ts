import { NextResponse } from "next/server";

/**
 * Redireciona para o Hub `/hub/bridge` com `to` = raiz do painel Construneves.
 * O Hub assina de novo o cookie `construneves_access_token` com `construneves_screens` atualizado.
 */
export async function GET() {
  const hubRaw = process.env.NEXTAUTH_URL?.trim();
  const panelRaw = process.env.NEXT_PUBLIC_CONSTRUNEVES_URL?.trim();
  if (!hubRaw || !panelRaw) {
    return new NextResponse("Defina NEXTAUTH_URL e NEXT_PUBLIC_CONSTRUNEVES_URL no ambiente.", {
      status: 500,
    });
  }
  const hub = new URL(hubRaw.endsWith("/") ? hubRaw : `${hubRaw}/`);
  const panel = new URL(panelRaw.includes("://") ? panelRaw : `https://${panelRaw}`);
  const bridge = new URL("/hub/bridge", hub);
  bridge.searchParams.set("to", `${panel.origin}/`);
  return NextResponse.redirect(bridge.toString());
}
