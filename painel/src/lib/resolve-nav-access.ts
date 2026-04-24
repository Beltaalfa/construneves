import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { hubJwtCookieName, isHubAuthEnabled } from "@/lib/auth";
import type { NavAccess } from "@/lib/construneves-screens";

/**
 * Lê o JWT do painel (já validado pelo middleware) e devolve o modo de filtro da sidebar.
 */
export async function resolveNavAccessFromCookies(): Promise<NavAccess> {
  if (!isHubAuthEnabled()) return { kind: "all" };
  const token = (await cookies()).get(hubJwtCookieName())?.value;
  if (!token) return { kind: "all" };
  try {
    const d = decodeJwt(token) as Record<string, unknown>;
    if (d.hub_role === "admin") return { kind: "all" };
    const screens = d.construneves_screens;
    if (!Array.isArray(screens)) return { kind: "all" };
    if (screens.length === 0) return { kind: "minimal" };
    const strings = screens.filter((x): x is string => typeof x === "string");
    return { kind: "granular", screens: strings };
  } catch {
    return { kind: "all" };
  }
}
